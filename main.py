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
    pool = await asyncpg.create_pool(**db)


@bot.event
async def on_ready():
    logging.warning("Logged in as %s (" +
                    "https://discordapp.com/oauth2/authorize?&" +
                    "client_id=%s&scope=bot)",
                    bot.user.name, bot.user.id)
    await connect(source_db, dest_db)


@bot.event
async def on_command_error(error, ctx):
    logging.error(error)
    if ctx.invoked_subcommand:
        pages = bot.formatter.format_help_for(
            ctx, ctx.invoked_subcommand)
        for page in pages:
            await bot.send_message(
                ctx.message.channel, page)
    else:
        pages = bot.formatter.format_help_for(
            ctx, ctx.command)
        for page in pages:
            await bot.send_message(
                ctx.message.channel, page)


@bot.command()
async def vainsocial(region: str, name: str):
    """Retrieves a player's stats."""
    if region not in ["na", "eu", "sg", "ea", "sa"]:
        await bot.say("That region is not supported.")
        return

    query = """
    SELECT
    player.name,
    match.game_mode,
    participant.hero, participant.winner,
    participant.kills, participant.deaths, participant.assists, participant.farm, 
    participant.skill_tier, player.played, player.wins,
    player.last_match_created_date::text
    FROM match, roster, participant, player where
      match.api_id=roster.match_api_id AND
      roster.api_id=participant.roster_api_id AND
      participant.player_api_id=player.api_id AND
      player.name=$1 AND player.last_match_created_date::text<>$2
    ORDER BY match.created_at DESC
    LIMIT 1
    """
    def msg(dct):
        tiers = ["Just Beginning", "Getting There", "Rock Solid", "Got Swagger", "Credible Threat", "The Hotness", "Simply Amazing", "Pinnacle Of Awesome", "Vainglorious"]
        if data["skill_tier"] == -1:
            tier = "Unranked"
        else:
            subtiers = ["Bronze", "Silver", "Gold"]
            tier = tiers[data["skill_tier"]//3-1] + " " + subtiers[data["skill_tier"]%3]
        modes = {
            "blitz_pvp_ranked": "Blitz",
            "casual_aral": "Battle Royale",
            "private": "private casual",
            "private_party_draft_match": "private draft",
            "private_party_blitz_match": "private Blitz",
            "private_party_aral_match": "private Battle Royale"
        }
        mode = modes.get(data["game_mode"]) or data["game_mode"]
        heroes = {
            "Sayoc": "Taka",
            "Hero009": "Krul",
            "Hero010": "Skaarf",
            "Hero016": "Rona"
        }
        hero = heroes.get(data["hero"]) or data["hero"].replace("*", "")

        return ("""
%s: %s, %s wins / %s games
Last match: %s %s as %s %s/%s/%s
""") % (
            data["name"], tier,
            data["wins"], data["played"],
            ("won" if data["winner"] else "lost"),
            mode, hero,
            data["kills"], data["deaths"], data["assists"]
        )

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
            msgid = await bot.say(msg(data))

        payload = {
            "region": region,
            "params": {
                "filter[createdAt-start]": lmcd,
                "filter[playerNames]": name
            }
        }
        jobid = await queue.request(jobtype="grab",
                                    payload=payload)

        while True:
            # wait for grab job to finish
            status = await queue.status(jobid)
            if status == 'finished':
                break
            if status == 'failed':
                if not in_cache:
                    await bot.edit_message(
                        "Could not find you.")
                return
            asyncio.sleep(0.1)

        while True:
            # wait for processor to update the player
            data = await con.fetchrow(query, name, lmcd)
            if data is not None:
                break
            asyncio.sleep(0.1)

        await bot.edit_message(msgid, msg(data))


logging.basicConfig(level=logging.INFO)
bot.run(os.environ["VAINSOCIAL_DISCORDTOKEN"])
