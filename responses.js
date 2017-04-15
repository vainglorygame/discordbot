#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    Discord = require("discord.js"),
    emoji = require("discord-emoji"),
    oneLine = require("common-tags").oneLine,
    api = require("./api");

function vainsocialEmbed(title, link) {
    return new Discord.RichEmbed()
        .setTitle(title)
        .setURL("https://vainsocial.com/" + link)
        .setColor("#55ADD3")
        .setAuthor("VainSocial", null, "https://vainsocial.com")
        .setFooter("VainSocial")
    ;
}

// returns the shortest version of the usage help
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
function formatMatch(participant) {
    let winstr = "Won";
    if (!participant.winner) winstr = "Lost";
    return `
${winstr} ${participant.game_mode_id} with \`${participant.actor.replace(/\*/g, "")}\`
KDA, CS | \`${participant.stats.kills}/${participant.stats.deaths}/${participant.stats.assists}\`, \`${Math.round(participant.stats.farm)}\`
Kill Participation | \`${Math.floor(100 * participant.stats.kill_participation)}%\`
Score | ${emojifyScore(participant.stats.impact_score)} \`${Math.floor(100 * participant.stats.impact_score)}%\`
`;
}

// return [[title, text], …] for rosters
function formatMatchDetail(match) {
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

// show player profile and last match
module.exports.showUser = async (msg, args) => {
    let ign = args.name,
        iterator = await api.searchPlayer(ign),
        response, player;
    while (true) {
        try {
            player = await iterator.next();
        } catch (err) {
            if (err == "not found") {
                await msg.say("Could not find player `" + ign + "`.");
                break;
            }
            if (err == "exhausted")
                break;
            if (err.statusCode == 404)
                continue;
        }
        let matches = (await api.searchMatches(ign)).data;
        let matchstr = "not available";
        if (matches.length > 0) matchstr = formatMatch(matches[0]);

        let embed = vainsocialEmbed(`${ign} - ${player.shard_id}`, "player/" + ign)
            .setThumbnail("https://vainsocial.com/images/game/skill_tiers/" +
                player.skill_tier + ".png")
            .setDescription("")
            .addField("Profile", formatPlayer(player), true)
            .addField("Last match", matchstr + `
*${emoji.symbols.information_source} or ${usg(msg, "vm " + ign)} for detail, ${emoji.symbols["1234"]} or ${usg(msg, "vh " + ign)} for more*
            `, true)
            .setTimestamp(new Date(player.last_match_created_date))
        ;

        if (response == undefined) {
            response = await msg.embed(embed);
            msg.client.on("messageReactionAdd", async (react) => {
                if (react.message != response) return;
                if (react.users.array().length <= 1) return;  // was me
                if (react.emoji.name == emoji.symbols.information_source)
                    await showMatch(msg, {
                        name: ign,
                        id: matches[0].match_api_id
                    });
                if (react.emoji.name == emoji.symbols["1234"])
                    await showMatches(msg, { name: ign });
            });
            await response.react(emoji.symbols.information_source);
            await response.react(emoji.symbols["1234"]);
        } else {
            response = await msg.editResponse(response, {
                type: "plain",
                content: "",
                options: { embed: embed }
            });
        }
    }
}

// show match in detail
let showMatch = module.exports.showMatch = async (msg, args) => {
    let response,
        ign = args.name,
        id = args.id,
        index = args.number;

    let match;
    try {
        if (id == undefined)
            id = (await api.searchMatches(ign)).data[index - 1].match_api_id;
        match = await api.searchMatch(id);
    } catch (err) {
        await msg.say(oneLine`
            Ooops! I don't have any data for you yet.
            Please take a look at your profile first!
            ${usg(msg, "v " + ign)}
        `);  // TODO!
        return;
    }
    let embed = vainsocialEmbed(`${match.game_mode}, \`${match.duration}\` minutes`, "match/" + id)
        .setTimestamp(new Date(match.created_at))
    formatMatchDetail(match).forEach(([title, text]) => {
        embed.addField(title, text, true);
    });
    ;
    response = await msg.editResponse(response, {
        type: "plain",
        content: "",
        options: { embed: embed }
    });
}

// show match history
let showMatches = module.exports.showMatches = async (msg, args) => {
    let ign = args.name,
        response;
    let count = [
        emoji.symbols.one,
        emoji.symbols.two,
        emoji.symbols.three,
        emoji.symbols.four,
        emoji.symbols.five,
        emoji.symbols.six,
        emoji.symbols.seven,
        emoji.symbols.eight,
        emoji.symbols.nine,
        emoji.symbols.ten
    ];
    let data, matches, matches_num;
    try {
        data = await api.searchMatches(ign);
    } catch (err) {
        await msg.say(oneLine`
            Ooops! I don't have any data for you yet.
            Please take a look at your profile first!
            ${usg(msg, "v " + ign)}
        `);  // TODO!
        return;
    }
    matches = data.data.slice(0, 3);
    matches_num = matches.length;

    let embed = vainsocialEmbed(ign, "player/" + ign)
        .setDescription(`
            Last ${matches_num} casual and ranked matches.
            *${emoji.symbols["1234"]} or ${usg(msg, "vm " + ign + " number")} for details*
        `);
    matches.forEach((match, idx) =>
        embed.addField(`Match ${idx + 1}`, formatMatch(match)));
    response = await msg.editResponse(response, {
        type: "plain",
        content: "",
        options: { embed: embed }
    });

    msg.client.on("messageReactionAdd", async (react) => {
        if (react.message != response) return;
        if (react.users.array().length <= 1) return;  // was me
        let idx = count.indexOf(react.emoji.name);
        if (idx == -1) return;
        await showMatch(msg, {
            name: ign,
            id: matches[idx].match_api_id
        });
    });

    for (let num of count.slice(0, matches_num))
        await response.react(num)
}
