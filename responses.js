#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    Promise = require("bluebird"),
    emoji = require("discord-emoji"),
    oneLine = require("common-tags").oneLine,
    util = require("./util"),
    api = require("./api");

const PREVIEW = process.env.PREVIEW != "false",
    MATCH_HISTORY_LEN = parseInt(process.env.MATCH_HISTORY_LEN) || 3,
    IGN_ROTATE_TIMEOUT = parseInt(process.env.IGN_ROTATE_TIMEOUT) || 300,
    ROOTURL = (PREVIEW? "https://preview.vainsocial.com/":"https://vainsocial.com/");

// based on impact score float, return an Emoji
function emojifyScore(score) {
    if (score > 0.7) return emoji.people.heart_eyes;
    if (score > 0.6) return emoji.people.blush;
    if (score > 0.5) return emoji.people.yum;
    if (score > 0.3) return emoji.people.relieved;
    return emoji.people.upside_down;
}

// return a match overview string
async function formatMatch(participant) {
    let winstr = "Won",
        hero = await api.mapActor(participant.actor),
        game_mode = await api.mapGameMode(participant.game_mode_id);
    if (!participant.winner) winstr = "Lost";
    return `
${winstr} ${game_mode} with \`${hero}\`
KDA, CS | \`${participant.stats.kills}/${participant.stats.deaths}/${participant.stats.assists}\`, \`${Math.round(participant.stats.farm)}\`
Kill Participation | \`${Math.floor(100 * participant.stats.kill_participation)}%\`
Score | ${emojifyScore(participant.stats.impact_score)} \`${Math.floor(100 * participant.stats.impact_score)}%\`
`;
}

// return [[title, text], …] for rosters
async function formatMatchDetail(match) {
    let strings = [];
    for(let roster of match.rosters) {
        let winstr = "Won";
        if (!roster.winner) winstr = "Lost";
        let rosterstr = `${roster.side} - \`${roster.hero_kills}\` Kills - ${winstr}`;
        let teamstr = "";
        for(let participant of roster.participants) {
            const hero = await api.mapActor(participant.actor);
            teamstr += `
\`${hero}\`, [${participant.player.name}](${ROOTURL}player/${participant.player.name}${util.track("match-detail")}) \`T${Math.floor(participant.skill_tier/3+1)}\` | \`${participant.stats.kills}/${participant.stats.deaths}/${participant.stats.assists}\`, \`${Math.floor(participant.stats.farm)}\`, Score ${emojifyScore(participant.stats.impact_score)} \`${Math.floor(100 * participant.stats.impact_score)}%\``;
        }
        strings.push([rosterstr, teamstr]);
    }
    return strings;
}

// return a profile string
async function formatPlayer(player) {
    const stats = oneLine`
            Win Rate | \`${Math.round(100 *
            player.currentSeries.reduce((t, s) => t + s.wins, 0) /
            player.currentSeries.reduce((t, s) => t + s.played, 0)
        )}%\`
        `,
        total_kda = oneLine`
            Total KDA | \`${player.stats.kills}\` / \`${player.stats.deaths}\` / \`${player.stats.assists}\`
        `;
    let best_hero = "",
        picks = "";
    if (player.best_hero.length > 0)
        best_hero = oneLine`
            Best | \`${player.best_hero[0].name}\`
        `;
    if (player.picks.length > 0) {
        const hero = await api.mapActor(player.picks[0].actor);
        picks = oneLine`
            Favorite | \`${hero}\`, \`${player.picks[0].hero_pick} picks\`
        `;
    }
    return `
${stats}
${total_kda}
${best_hero}
${picks}
    `;
}

module.exports.rotateGameStatus = (client) => {
    (async function rotate() {
        const gamers = await api.getGamers(),
            idx = Math.floor(Math.random() * (gamers.length - 1)) + 1;
        if (PREVIEW) await client.user.setGame(
            `?v ${gamers[idx]} | preview.vainsocial.com`);
        else await client.user.setGame(
            `!v ${gamers[idx]} | vainsocial.com`);
        setTimeout(rotate, IGN_ROTATE_TIMEOUT * 1000);
    })();
}

// about
module.exports.showAbout = async (msg) => {
    util.trackAction(msg, "about");
    await msg.embed(util.vainsocialEmbed("About VainSocial", "", "about")
        .setDescription(
`Built by the VainSocial development team using the MadGlory API.
Currently running on ${msg.client.guilds.size} servers.`)
        .addField("Website",
            ROOTURL + util.track("about"), true)
        .addField("Bot invite link",
            "https://discordapp.com/oauth2/authorize?&client_id=287297889024213003&scope=bot&permissions=52288", true)
        .addField("Developer Discord invite",
            "https://discord.gg/txTchJY", true)
        .addField("Twitter",
            "https://twitter.com/vainsocial", true)
    );
}

// return the sqlite stored ign for this user
async function nameByUser(msg) {
    const user = await api.get("/user", { user_token: msg.author.id });
    if (user) return user.name;
    return undefined;
}

// show player profile and last match
module.exports.showUser = async (msg, args) => {
    let responded = false,
        response,
        ign = args.name,
        reactionsAdded = false;
    util.trackAction(msg, "vainsocial-user", ign);

    // shorthand
    // "?" is not accepted as user input, but the default for empty
    if (ign == "?") {
        ign = await nameByUser(msg);
        if (ign == undefined) {
            await msg.reply(util.formatSorryUnknown(msg));
            return;
        }
    }

    const waiter = await api.subscribeUpdates(ign, true);
    do {
        const [player, matches] = await Promise.all([
            api.getPlayer(ign),
            api.getMatches(ign)
        ]);
        if (player == undefined || matches.length == 0) {
            response = await util.respond(msg,
                "Loading your data…", response);
            continue;
        }

        const moreHelp = oneLine`
*${emoji.symbols.information_source} or ${util.usg(msg, "vm " + ign)} for detail,
${emoji.symbols["1234"]} or ${util.usg(msg, "vh " + ign)} for more*`

        const embed = util.vainsocialEmbed(`${ign} - ${player.shard_id}`, "player/" + ign, "vainsocial-user")
            .setThumbnail(ROOTURL + "images/game/skill_tiers/" +
                matches[0].skill_tier + ".png")
            .setDescription("")
            .addField("Profile", await formatPlayer(player), true)
            .addField("Last match", await formatMatch(matches[0]) + moreHelp, true)
            .setTimestamp(new Date(matches[0].created_at));
        response = await util.respond(msg, embed, response);

        if (!reactionsAdded) {
            // build reaction buttton bar
            reactionsAdded = true;
            let reactionWaiter = util.awaitReactions(response,
                [emoji.symbols.information_source, emoji.symbols["1234"]]);
            (async () => {
                while (true) {
                    let rmoji = await reactionWaiter.next();
                    if (rmoji == undefined) break;  // timeout
                    if (rmoji == emoji.symbols.information_source) {
                        util.trackAction(msg, "reaction-match", ign);
                        await respondMatch(msg, ign, matches[0].match_api_id);
                    }
                    if (rmoji == emoji.symbols["1234"]) {
                        util.trackAction(msg, "reaction-matches", ign);
                        await respondMatches(msg, ign);
                    }
                }
            })();  // async in background
        }
    } while (await waiter.next() != undefined);
    if (!reactionsAdded)
        await util.respond(msg, `Could not find \`${ign}\`.`, response);
}

// show match in detail
async function respondMatch(msg, ign, id, response=undefined) {
    const match = await api.getMatch(id);

    let embed = util.vainsocialEmbed(`${match.game_mode}, ${match.duration} minutes`,
        "player/" + ign + "/match/" + id, "vainsocial-match")
        .setTimestamp(new Date(match.created_at));
    (await formatMatchDetail(match)).forEach(([title, text]) => {
        embed.addField(title, text, true);
    });
    return await util.respond(msg, embed, response);
}

module.exports.showMatch = async (msg, args) => {
    const index = args.number;
    let responded = false,
        ign = args.name,
        response;
    util.trackAction(msg, "vainsocial-match", ign);

    // shorthand
    if (ign == "?") {
        ign = await nameByUser(msg);
        if (ign == undefined) {
            await msg.reply(util.formatSorryUnknown(msg));
            return;
        }
    }

    const waiter = await api.subscribeUpdates(ign, true);
    do {
        const matches = await api.getMatches(ign);
        if (index > matches.length) {
            response = await util.respond(msg, "Not enough matches yet.",
                response);
            continue;
        }
        const id = matches[index - 1].match_api_id;
        response = await respondMatch(msg, ign, id, response);
        responded = true;
    } while (await waiter.next() != undefined);
    if (!responded)
        await util.respond(msg, `Could not find \`${ign}\`.`, response);
}

// show match history
async function respondMatches(msg, ign, response=undefined) {
    const count = [ emoji.symbols.one, emoji.symbols.two, emoji.symbols.three,
        emoji.symbols.four, emoji.symbols.five, emoji.symbols.six,
        emoji.symbols.seven, emoji.symbols.eight, emoji.symbols.nine,
        emoji.symbols.ten
    ];
    const match_data = await api.getMatches(ign),
        matches = match_data.slice(0, MATCH_HISTORY_LEN),
        matches_num = matches.length;

    // not enough data
    if (matches_num == 0) return await util.respond(msg,
        "No match history yet.", response);

    // build embed
    let embed = util.vainsocialEmbed(ign, "player/" + ign, "vainsocial-matches")
        .setDescription(`
Last ${matches_num} casual and ranked matches.
*${emoji.symbols["1234"]} or ${util.usg(msg, "vm " + ign + " number")} for details*
        `)
        .setTimestamp(new Date(matches[0].created_at));
    await Promise.each(matches, async (match, idx) =>
        embed.addField(`Match ${idx + 1}`, await formatMatch(match))
    );
    response = await util.respond(msg, embed, response);

    // reaction button bar
    const reactionWaiter = util.awaitReactions(response,
        count.slice(0, matches_num));
    (async () => {
        while (true) {
            let rmoji = await reactionWaiter.next();
            if (rmoji == undefined) break;  // timeout
            let idx = count.indexOf(rmoji);
            await respondMatch(msg, ign, matches[idx].match_api_id);
            util.trackAction(msg, "reaction-match", ign);
        }
    })();  // async in background
    return response;
}

module.exports.showMatches = async (msg, args) => {
    let ign = args.name,
        responded = false,
        response;
    util.trackAction(msg, "vainsocial-matches", ign);

    // shorthand
    if (ign == "?") {
        ign = await nameByUser(msg);
        if (ign == undefined) {
            await msg.reply(util.formatSorryUnknown(msg));
            return;
        }
    }

    const waiter = await api.subscribeUpdates(ign, true);
    do {
        response = await respondMatches(msg, ign, response);
        responded = true;
    } while (await waiter.next() != undefined);
    if (!responded)
        await util.respond(msg, `Could not find \`${ign}\`.`,
            response);
}
