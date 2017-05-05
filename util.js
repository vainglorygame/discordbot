#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Discord = require("discord.js"),
    ua = require("universal-analytics"),
    Promise = require("bluebird"),
    Channel = require("async-csp").Channel;

const GOOGLEANALYTICS_ID = process.env.GOOGLEANALYTICS_ID,
    REACTION_TIMEOUT = parseInt(process.env.REACTION_TIMEOUT) || 60,  // s
    PREVIEW = process.env.PREVIEW != "false",
    ROOTURL = (PREVIEW? "https://preview.vainsocial.com/":"https://vainsocial.com/");

const reactionsPipe = new Channel();

// embed template
module.exports.vainsocialEmbed = (title, link, command) => {
    return new Discord.RichEmbed()
        .setTitle(title)
        .setColor("#55ADD3")
        .setURL(ROOTURL + link + module.exports.track(command))
        .setAuthor("VainSocial" + (PREVIEW? " preview":""), ROOTURL + "images/brands/logo-blue.png",
            ROOTURL + module.exports.track(command))
        .setFooter("VainSocial" + (PREVIEW? " preview":""), ROOTURL + "images/brands/logo-blue.png")
};

// analytics url
module.exports.track = (command) => {
    return "?utm_source=discordbot&utm_medium=discord&utm_campaign=" + command;
};

// direct analytics
module.exports.trackAction = (msg, action, ign="") => {
    if (GOOGLEANALYTICS_ID == undefined) return;
    const user = ua(GOOGLEANALYTICS_ID, msg.author.id,
        { strictCidFormat: false });
    user.pageview({
        documentPath: action,
        documentTitle: ign,
        campaignSource: msg.guild.id,
        campaignMedium: msg.guild.name
    }).send();
};

// return the shortest version of the usage help
// just '?vm'
module.exports.usg = (msg, cmd) => {
    return msg.anyUsage(cmd, undefined, null);
};

// reaction -> pipe ->>> consumers
// handle new reaction event
module.exports.onNewReaction = (reaction) => {
    if (reaction.users.array().length <= 1) return;  // was me TODO
    reactionsPipe.put(reaction);
};

// create an iterator that returns promises to await new reactions
// the Promise result is the reaction name
module.exports.awaitReactions = (message, emoji, timeout=REACTION_TIMEOUT) => {
    const pipeOut = new Channel();
    let reactions = [];
    // stop listening after timeout
    setTimeout(() => {
        pipeOut.close();
        Promise.map(reactions, async (r) => r.remove());
    }, timeout*1000);

    // async in background
    Promise.each(emoji, async (em) =>
        reactions.push(await message.react(em)));

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
};

// respond or say text or embed
module.exports.respond = async (msg, data, response) => {
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
            if (response.embeds.length ==0 ||
                new Date(response.embeds[0].createdTimestamp).getTime()
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
};

// tell the user that they need to store their name
module.exports.formatSorryUnknown = (msg) =>
    `You're unknown to our service. Try ${module.exports.usg(msg, "help vme")}.`;
