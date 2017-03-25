#!/usr/bin/env python3

import logging
import os
import http
import json
import asyncio
import asyncpg
import discord
from discord.ext import commands
from socketIO_client import SocketIO, LoggingNamespace

db = {
    "host": os.environ.get("POSTGRESQL_DEST_HOST") or "localhost",
    "port": os.environ.get("POSTGRESQL_DEST_PORT") or 5432,
    "user": os.environ.get("POSTGRESQL_DEST_USER") or "vainweb",
    "password": os.environ.get("POSTGRESQL_DEST_PASSWORD") or "vainweb",
    "database": os.environ.get("POSTGRESQL_DEST_DB") or "vainsocial-web"
}


bot = commands.Bot(
    command_prefix="?",
    description="Vainsocial Vainglory stats bot")

pool = None


@bot.event
async def on_ready():
    logging.warning("Logged in as %s (" +
                    "https://discordapp.com/oauth2/authorize?&" +
                    "client_id=%s&scope=bot)",
                    bot.user.name, bot.user.id)
    logging.warning("connecting to database")
    global pool
    pool = await asyncpg.create_pool(
        min_size=2, **db)
    await bot.change_presence(
        game=discord.Game(
            name="vainsocial.com"))


@bot.command()
async def about():
    """Print invite links."""
    emb = discord.Embed(
        title="Vainsocial Discord bot",
        description="Built by the Vainsocial development team using the MadGlory API. Currently running on %i servers." % (len(bot.servers),)
    )
    emb.add_field(name="Website",
                  value="[vainsocial.com](https://vainsocial.com/?utm_source=discord&utm_medium=vainsocial)")
    emb.add_field(name="Bot invite link",
                  value="[discordapp.com](https://discordapp.com/oauth2/authorize?&client_id=287297889024213003&scope=bot)")
    emb.add_field(name="Developer Discord",
                  value="[discord.me/vainsocial](https://discord.me/vainsocial)")
    emb.add_field(name="Twitter",
                  value="[twitter/vainsocial](https://twitter.com/vainsocial)")
    await bot.say(embed=emb)


@bot.command(aliases=["v", "vain"])
async def vainsocial(name: str):
    """Retrieves a player's stats."""
    query = """
    SELECT
    player.name,
    player.shard_id,
    match.game_mode,
    roster.match_api_id,
    participant.hero, participant.winner,
    participant.kills, participant.deaths, participant.assists, participant.farm, 
    player.skill_tier, player.played, player.wins,
    player.last_match_created_date::text
    FROM match, roster, participant, player WHERE
      match.api_id=roster.match_api_id AND
      roster.api_id=participant.roster_api_id AND
      participant.player_api_id=player.api_id AND
      player.name=$1
    ORDER BY match.created_at DESC
    LIMIT 1
    """
    def emb(dct):
        data = dict(dct)

        modes = {
            "blitz_pvp_ranked": "Blitz",
            "casual_aral": "Battle Royale",
            "private": "private casual",
            "private_party_draft_match": "private draft",
            "private_party_blitz_match": "private Blitz",
            "private_party_aral_match": "private Battle Royale"
        }
        data["mode"] = modes.get(data["game_mode"]) or data["game_mode"]
        heroes = {
            "Sayoc": "Taka",
            "Hero009": "Krul",
            "Hero010": "Skaarf",
            "Hero016": "Rona"
        }
        data["hero"] = data["hero"].replace("*", "")
        data["hero"] = heroes.get(data["hero"]) or data["hero"]
        data["result"] = "won" if data["winner"] else "lost"

        emb = discord.Embed(
            title="%(name)s (%(shard_id)s)" % data,
            description="Last match registered (GMT): %(last_match_created_date)s" % data,
            url="https://vainsocial.com/players/%(shard_id)s/%(name)s/?utm_source=discord&utm_medium=vainsocial" % data
        )
        emb.set_author(name="Vainsocial",
                       url="https://vainsocial.com")
        emb.add_field(name="Profile",
                      value=("%(wins)i wins / %(played)i games\n" +
                             "[View on vainsocial.com](https://vainsocial.com/players/%(shard_id)s/%(name)s/?utm_source=discord&utm_medium=vainsocial)") % data)
        emb.add_field(name="Last match",
                      value=("%(result)s %(mode)s as %(hero)s %(kills)i/%(deaths)i/%(assists)i\n" +
                             "[View on vainsocial.com](https://vainsocial.com/matches/%(match_api_id)s/?utm_source=discord&utm_medium=vainsocial)") % data)

        emb.set_footer(text="Vainsocial - Vainglory social stats service")
        emb.set_thumbnail(url="https://vainsocial.com/images/game/skill_tiers/%(skill_tier)s.png" % data)
        return emb

    async with pool.acquire() as con:
        await bot.type()

        bot_response = await bot.say("Loading…")
        # TODO this is shitty. Shouldn't need globals to keep track of updates
        # also, this is buggy.
        # TODO: Use a Python-friendly alternative to socketio
        global do_update, wait_for_update
        wait_for_update = True  # continue polling
        do_update = True  # poll immediately

        async def request_update():
            global wait_for_update
            # request an update via Vainsocial API
            api_con = http.client.HTTPConnection("localhost", 8080)
            api_con.request("HEAD", "/api/player/name/" + name)
            api_resp = api_con.getresponse()
            logging.info("%s: API responded with status %i",
                         name, api_resp.status)
            if api_resp.status == 404:
                wait_for_update = False
                await bot.edit_message(bot_response,
                                       "Could not find you.")
            api_con.close()

        def update_available(*args):
            global do_update, wait_for_update
            # TODO here is the problem ^ don't work in closures :(
            if args[0] in ["process_finished", "compile_finished"]:
                do_update = True
            if args[0] in ["grab_failed", "process_finished",
                           "compile_finished"]:
                wait_for_update = False

        io = SocketIO("localhost", 8080, LoggingNamespace)
        io.on(name, update_available)

        asyncio.ensure_future(request_update())

        has_embed = False
        for _ in range(10):  # try for 10s
            if do_update:
                logging.info("%s: updating bot response",
                             name)
                do_update = False
                data = await con.fetchrow(query, name)
                if data is not None:
                    has_embed = True
                    await bot.edit_message(bot_response,
                                           embed=emb(data))
                else:
                    logging.info("%s: no data in db, waiting for API",
                                 name)
            if not wait_for_update:
                break
            io.wait(seconds=1)

        if has_embed:
            await bot.edit_message(bot_response, "Up to date.")
        # if not, 404


logging.basicConfig(level=logging.INFO)
bot.run(os.environ["VAINSOCIAL_DISCORDTOKEN"])
