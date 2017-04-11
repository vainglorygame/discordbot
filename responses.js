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
        .setFooter("VainSocial - Vainglory social stats service")
    ;
}

// returns the shortest version of the usage help
// just '?vm'
function usg(msg, cmd) {
    return msg.anyUsage(cmd, undefined, null);
}

// TODO, obviously

// show player profile and last match
module.exports.showUser = async (msg, args) => {
    let ign = args.name,
        iterator = await api.searchPlayer(ign),
        response, data;
    while (true) {
        try {
            data = await iterator.next();
        } catch (err) {
            if (err.statusCode == 404) {
                await msg.reply("Could not find `" + ign + "`");
                break;
            }
            if (err == "exhausted")
                break;
        }
        let winstr = "won";
        if (data.last_result[0].winner == false) winstr = "lost";

        let embed = vainsocialEmbed(ign, "player/" + ign)
            .setThumbnail("https://vainsocial.com/images/game/skill_tiers/" +
                data.skill_tier + ".png")
            .setDescription("")
            .addField("Profile", `
                (Player stats will be here)
            `)
            .addField("Last match", oneLine`
                Played ${data.last_result[0].game_mode_id} with ${data.last_result[0].actor}, ${winstr}
                *${emoji.symbols.information_source} or ${usg(msg, "vm " + ign)} for more*
            `)
            .setTimestamp(new Date(data.last_match_created_date))
        ;

        if (response == undefined) {
            response = await msg.replyEmbed(embed);
            await response.react(emoji.symbols.information_source);
            msg.client.on("messageReactionAdd", async (react) => {
                if (react.message != response) return;
                if (react.emoji != emoji.symbols.information_source) return;
                await showMatch(msg, {
                    name: ign,
                    id: data.last_result[0].match_api_id
                });
            });
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
        index = args.number,
        match;
    if (id != null) match = {};
    else match = {};  // fetch match from API
    let embed = vainsocialEmbed("A Match", "match/" + 12345)
        .setDescription("A lot of stuff happened here. This was ranked or casual?")
        .addField("Left team", `
            Killed some heroes from the right team and someone died
        `)
        .addField("Right team", `
            Did good work too. Poor minions.
        `)
        //.setTimestamp(new Date(data.last_match_created_date))
    ;
    response = await msg.editResponse(response, {
        type: "plain",
        content: "",
        options: { embed: embed }
    });
}

// show match history
module.exports.showMatches = async (msg, args) => {
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
    let embed = vainsocialEmbed(ign, "player/" + ign)
        .setDescription(`
            Last 1337 casual and ranked matches.
            *${emoji.symbols["1234"]} or ${usg(msg, "vm " + ign)} number for details*
        `)
        .addField("Match 1", `
            Blablabla. Blabla.
        `)
        .addField("Match 2", `
            Ooooh did a Minion just walk into our base?
        `)
    ;
    response = await msg.editResponse(response, {
        type: "plain",
        content: "",
        options: { embed: embed }
    });

    msg.client.on("messageReactionAdd", async (react) => {
        if (react.message != response) return;
        if (react.count == 1) return;  // was me
        let idx = count.indexOf(react.emoji.name);
        if (idx == -1) return;
        await showMatch(msg, {
            name: ign,
            number: idx
        });
    });

    for (let num of count)
        await response.react(num)
}
