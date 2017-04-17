#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    Discord = require("discord.js"),
    Promise = require("bluebird"),
    emoji = require("discord-emoji"),
    oneLine = require("common-tags").oneLine,
    Channel = require("async-csp").Channel,
    api = require("./api");

const PREVIEW = process.env.PREVIEW || true,
    MATCH_HISTORY_LEN = parseInt(process.env.MATCH_HISTORY_LEN) || 3;

const reactionsPipe = new Channel();

// embed template
function vainsocialEmbed(title, link) {
    let embed = new Discord.RichEmbed()
        .setTitle(title)
        .setColor("#55ADD3");
    if (PREVIEW) {
        embed
            .setURL("https://preview.vainsocial.com/" + link)
            .setAuthor("VainSocial preview", null,
                "https://preview.vainsocial.com")
            .setFooter("VainSocial preview");
    } else {
        embed
            .setURL("https://vainsocial.com/" + link)
            .setAuthor("VainSocial", null, "https://vainsocial.com")
            .setFooter("VainSocial");
    }
    return embed;
}

// return the shortest version of the usage help
// just '?vm'
function usg(msg, cmd) {
    return msg.anyUsage(cmd, undefined, null);
}

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
        game_mode = await api.mapGameMode(participant.game_mode_id);
    if (!participant.winner) winstr = "Lost";
    return `
${winstr} ${game_mode} with \`${participant.actor.replace(/\*/g, "")}\`
KDA, CS | \`${participant.stats.kills}/${participant.stats.deaths}/${participant.stats.assists}\`, \`${Math.round(participant.stats.farm)}\`
Kill Participation | \`${Math.floor(100 * participant.stats.kill_participation)}%\`
Score | ${emojifyScore(participant.stats.impact_score)} \`${Math.floor(100 * participant.stats.impact_score)}%\`
`;
}

// return [[title, text], …] for rosters
async function formatMatchDetail(match) {
    let strings = [];
    for(let roster of match.rosters) {
        let rosterstr = `${roster.side} - \`${roster.hero_kills}\` Kills`;
        let teamstr = "";
        for(let participant of roster.participants) {
            teamstr += `
\`${participant.actor.replace(/\*/g, "")}\`, [${participant.player.name}](https://vainsocial.com/player/${participant.player.name}) \`T${Math.floor(participant.skill_tier/3)}\` | \`${participant.stats.kills}/${participant.stats.deaths}/${participant.stats.assists}\`, \`${Math.floor(participant.stats.farm)}\`, Score ${emojifyScore(participant.stats.impact_score)} \`${Math.floor(100 * participant.stats.impact_score)}%\``;
        }
        strings.push([rosterstr, teamstr]);
    }
    return strings;
}

// return a profile string
function formatPlayer(player) {
    let stats = oneLine`
            Win Rate | \`${Math.round(100 *
            player.currentSeries.reduce((t, s) => t + s.wins, 0) /
            player.currentSeries.reduce((t, s) => t + s.played, 0)
        )}%\`
        `,
        total_kda = oneLine`
            Total KDA | \`${player.stats.kills}\` / \`${player.stats.deaths}\` / \`${player.stats.assists}\`
        `,
        best_hero = "",
        picks = "";
    if (player.best_hero.length > 0)
        best_hero = oneLine`
            Best | \`${player.best_hero[0].name}\`
        `;
    if (player.picks.length > 0)
        picks = oneLine`
            Favorite | \`${player.picks[0].name}\`, \`${player.picks[0].hero_pick} picks\`
        `;
    return `
${stats}
${total_kda}
${best_hero}
${picks}
    `;
}

// reaction -> pipe ->>> consumers
// handle new reaction event
module.exports.onNewReaction = (reaction) => {
    if (reaction.users.array().length <= 1) return;  // was me TODO
    reactionsPipe.put(reaction);
}

// create an iterator that returns promises to await new reactions
// the Promise result is the reaction name
function awaitReactions(message, emoji, timeout=60) {
    const pipeOut = new Channel();
    // stop listening after timeout
    setTimeout(() => pipeOut.close(), timeout*1000);

    Promise.each(emoji, async (em) =>
        message.react(em));  // async in background

    let reaction;
    reactionsPipe.pipe(pipeOut);
    return {
        next: async function() {
            do {
                reaction = await pipeOut.take();
                if (reaction == Channel.DONE)
                    return undefined;
            } while (reaction.message.id != message.id ||
                emoji.indexOf(reaction.emoji.name) == -1);
            return reaction.emoji.name;
        }
    }
}

// respond or say text or embed
async function respond(msg, data, response) {
    if (response == undefined) {
        if (typeof data === "string") {
            response = await msg.say(data);
        } else {
            response = await msg.embed(data);
        }
    } else {
        if (typeof data === "string") {
            if (data != response.content)
                await response.edit(data);
        } else {
            if (new Date(response.embeds[0].createdTimestamp).getTime()
                != data.timestamp.getTime())
                // TODO how2 edit embed properly?!
                await msg.editResponse(response, {
                    type: "plain",
                    content: "",
                    options: { embed: data }
                });
        }
    }
    return response;
}

// about
module.exports.showAbout = async (msg) => {
    await msg.embed(vainsocialEmbed("About VainSocial", "")
        .setDescription(
`Built by the VainSocial development team using the MadGlory API.
Currently running on ${msg.client.guilds.size} servers.`)
        .addField("Website",
            "https://vainsocial.com", true)
        .addField("Bot invite link",
            "https://discordapp.com/oauth2/authorize?&client_id=287297889024213003&scope=bot&permissions=52288", true)
        .addField("Developer Discord invite",
            "https://discord.gg/txTchJY", true)
        .addField("Twitter",
            "https://twitter.com/vainsocial", true)
    );
}

// show player profile and last match
module.exports.showUser = async (msg, args) => {
    const ign = args.name,
        waiter = api.subscribeUpdates(ign);
    let responded = false,
        response,
        reactionsAdded = false;

    while (await waiter.next() != undefined) {
        const [player, matches] = await Promise.all([
            api.getPlayer(ign),
            api.getMatches(ign)
        ]);
        if (player == undefined) {
            response = await respond(msg,
                "Loading your data…", response);
            continue;
        }
        if (matches == undefined || matches.data.length == 0) {
            response = await respond(msg,
                "No match history for you yet", response);
            continue;
        }

        const moreHelp = oneLine`
*${emoji.symbols.information_source} or ${usg(msg, "vm " + ign)} for detail,
${emoji.symbols["1234"]} or ${usg(msg, "vh " + ign)} for more*`

        const embed = vainsocialEmbed(`${ign} - ${player.shard_id}`, "player/" + ign)
            .setThumbnail("https://vainsocial.com/images/game/skill_tiers/" +
                matches.data[0].skill_tier + ".png")
            .setDescription("")
            .addField("Profile", formatPlayer(player), true)
            .addField("Last match", await formatMatch(matches.data[0]) + moreHelp, true)
            .setTimestamp(new Date(matches.data[0].created_at));
        response = await respond(msg, embed, response);

        if (!reactionsAdded) {
            reactionsAdded = true;
            let reactionWaiter = awaitReactions(response,
                [emoji.symbols.information_source, emoji.symbols["1234"]]);
            (async () => {
                while (true) {
                    let rmoji = await reactionWaiter.next();
                    if (rmoji == undefined) break;  // timeout
                    if (rmoji == emoji.symbols.information_source)
                        await respondMatch(msg, ign, matches.data[0].match_api_id);
                    if (rmoji == emoji.symbols["1234"])
                        await respondMatches(msg, ign);
                }
            })();  // async in background
        }
    }
    if (!reactionsAdded)
        await respond(msg, `Could not find \`${ign}\`.`, response);
}

// show match in detail
async function respondMatch(msg, ign, id, response=undefined) {
    const match = await api.getMatch(id);

    let embed = vainsocialEmbed(`${match.game_mode}, ${match.duration} minutes`, "match/" + id)
        .setTimestamp(new Date(match.created_at));
    (await formatMatchDetail(match)).forEach(([title, text]) => {
        embed.addField(title, text, true);
    });
    return await respond(msg, embed, response);
}

module.exports.showMatch = async (msg, args) => {
    const ign = args.name,
        index = args.number,
        waiter = api.subscribeUpdates(ign);
    let responded = false,
        response;

    while (await waiter.next() != undefined) {
        let matches = await api.getMatches(ign);
        if (matches == undefined || matches.data.length == 0) {
            response = await respond(msg, "No matches for you yet",
                response);
            continue;
        }
        if (index - 1 > matches.data.length) {
            response = await respond(msg, "Not enough matches yet",
                response);
            continue;
        }
        let id = matches.data[index -1].match_api_id;
        response = await respondMatch(msg, ign, id, response);
        responded = true;
    }
    if (!responded)
        await respond(msg, `Could not find \`${ign}\`.`, response);
}

// show match history
async function respondMatches(msg, ign, response=undefined) {
    const count = [ emoji.symbols.one, emoji.symbols.two, emoji.symbols.three,
        emoji.symbols.four, emoji.symbols.five, emoji.symbols.six,
        emoji.symbols.seven, emoji.symbols.eight, emoji.symbols.nine,
        emoji.symbols.ten
    ];
    const data = await api.getMatches(ign),
        matches = data.data.slice(0, MATCH_HISTORY_LEN),
        matches_num = matches.length;

    let embed = vainsocialEmbed(ign, "player/" + ign)
        .setDescription(`
Last ${matches_num} casual and ranked matches.
*${emoji.symbols["1234"]} or ${usg(msg, "vm " + ign + " number")} for details*
        `)
        .setTimestamp(new Date(matches[0].created_at));
    await Promise.each(matches, async (match, idx) =>
        embed.addField(`Match ${idx + 1}`, await formatMatch(match))
    );
    response = await respond(msg, embed, response);

    const reactionWaiter = awaitReactions(response,
        count.slice(0, matches_num));
    (async () => {
        while (true) {
            let rmoji = await reactionWaiter.next();
            if (rmoji == undefined) break;  // timeout
            let idx = count.indexOf(rmoji);
            await respondMatch(msg, ign, matches[idx].match_api_id);
        }
    })();  // async in background
    return response;
}

module.exports.showMatches = async (msg, args) => {
    const ign = args.name,
        waiter = api.subscribeUpdates(ign);
    let responded = false,
        response;

    while (await waiter.next() != undefined) {
        let matches = await api.getMatches(ign);
        if (matches == undefined || matches.data.length == 0) {
            response = await respond(msg, "No matches for you yet",
                response);
            continue;
        }
        response = await respondMatches(msg, ign, response);
        responded = true;
    }
    if (!responded)
        await respond(msg, `Could not find \`${ign}\`.`,
            response);
}
