#!/usr/bin/env python3

import logging
import os
import asyncio
import asyncpg
import discord
from discord.ext import commands
import joblib.joblib

source_db = {
    "host": os.environ.get("POSTGRESQL_SOURCE_HOST") or "localhost",
    "port": os.environ.get("POSTGRESQL_SOURCE_PORT") or 5433,
    "user": os.environ.get("POSTGRESQL_SOURCE_USER") or "vainraw",
    "password": os.environ.get("POSTGRESQL_SOURCE_PASSWORD") or "vainraw",
    "database": os.environ.get("POSTGRESQL_SOURCE_DB") or "vainsocial-raw"
}

dest_db = {
    "host": os.environ.get("POSTGRESQL_DEST_HOST") or "localhost",
    "port": os.environ.get("POSTGRESQL_DEST_PORT") or 5432,
    "user": os.environ.get("POSTGRESQL_DEST_USER") or "vainweb",
    "password": os.environ.get("POSTGRESQL_DEST_PASSWORD") or "vainweb",
    "database": os.environ.get("POSTGRESQL_DEST_DB") or "vainsocial-web"
}


bot = commands.Bot(
    command_prefix="!",
    description="Vainsocial Vainglory stats bot")

queue = None
pool = None

async def connect(queuedb, db):
    logging.warning("connecting to database")

    global queue
    queue = joblib.joblib.JobQueue()
    await queue.connect(**queuedb)
    await queue.setup()

    global pool
    pool = await asyncpg.create_pool(
        min_size=1, **db)


@bot.event
async def on_ready():
    logging.warning("Logged in as %s (" +
                    "https://discordapp.com/oauth2/authorize?&" +
                    "client_id=%s&scope=bot)",
                    bot.user.name, bot.user.id)
    await connect(source_db, dest_db)
    await bot.change_presence(
        game=discord.Game(
            name="alpha.vainsocial.com"))


@bot.command()
async def about():
    """Print invite links."""
    emb = discord.Embed(
        title="Vainsocial Discord bot",
        description="Built by the Vainsocial development team using the MadGlory API."
    )
    emb.add_field(name="Website",
                  value="https://alpha.vainsocial.com")
    emb.add_field(name="Bot invite link",
                  value="https://discordapp.com/oauth2/authorize?&client_id=287297889024213003&scope=bot")
    emb.add_field(name="Developer Discord",
                  value="https://discord.gg/txTchJY")
    emb.add_field(name="Twitter",
                  value="https://twitter.com/vainsocial")
    await bot.say(embed=emb)


@bot.command(aliases=["v", "vain"])
async def vainsocial(name: str, region: str = None):
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
    FROM match, roster, participant, player where
      match.api_id=roster.match_api_id AND
      roster.api_id=participant.roster_api_id AND
      participant.player_api_id=player.api_id AND
      player.name=$1 AND player.last_match_created_date::text<>$2
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
            title="%(name)s" % data,
            url="https://alpha.vainsocial.com/players/%(shard_id)s/%(name)s" % data
        )
        emb.set_author(name="Vainsocial",
                       url="https://alpha.vainsocial.com")
        emb.add_field(name="Profile",
                      value=("%(wins)i wins / %(played)i games\n" +
                             "https://alpha.vainsocial.com/players/%(shard_id)s/%(name)s") % data)
        emb.add_field(name="Last match",
                      value=("%(result)s %(mode)s as %(hero)s %(kills)i/%(deaths)i/%(assists)i\n" +
                             "https://alpha.vainsocial.com/matches/%(match_api_id)s") % data)

        emb.set_footer(text="Vainsocial - Vainglory social stats service")
        emb.set_thumbnail(url="https://alpha.vainsocial.com/images/game/skill_tiers/%(skill_tier)s.png" % data)
        return emb

    async with pool.acquire() as con:
        await bot.type()

        data = await con.fetchrow(query, name, 'NULL')
        if data is None:
            in_cache = False  # new user
            lmcd = "2017-02-01T00:00:00Z"
            msgid = await bot.say(
                "%s: please wait…" % name)
        else:
            in_cache = True  # returning user
            lmcd = data["last_match_created_date"]
            msgid = await bot.say(embed=emb(data))

        if not in_cache:
            if region is None:
                await bot.edit_message(msgid,
                    "Can't find you. What is your region?")
                return
            region = region.lower()
            if region not in ["na", "eu", "sg", "ea", "sa"]:
                await bot.edit_message(msgid,
                    "That region is not supported.")
                return
        else:
            if region is None:
                region = data["shard_id"]

        logging.info("'%s' cached: %s", name, in_cache)

        payload = {
            "region": region,
            "params": {
                "filter[createdAt-start]": lmcd,
                "filter[playerNames]": name
            }
        }
        jobid = (await queue.request(jobtype="grab",
                                     payload=[payload],
                                     priority=[1]))[0]

        while True:
            # wait for grab job to finish
            status = await queue.status(jobid)
            if status == 'finished':
                break
            if status == 'failed':
                logging.warning("'%s': not found", name)
                if not in_cache:
                    await bot.edit_message(msgid,
                        "Could not find you.")
                return
            asyncio.sleep(0.5)

        while True:
            # wait for processor to update the player
            data = await con.fetchrow(query, name, lmcd)
            if data is not None:
                break
            asyncio.sleep(0.5)

        await bot.edit_message(msgid, embed=emb(data))


logging.basicConfig(level=logging.INFO)
bot.run(os.environ["VAINSOCIAL_DISCORDTOKEN"])
