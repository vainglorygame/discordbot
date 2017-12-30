#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const emoji = require("discord-emoji"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    api = require("./api"),
    util = require("./util");
const strings = module.exports;

const MATCH_HISTORY_LEN = parseInt(process.env.MATCH_HISTORY_LEN) || 3,
    PREVIEW = process.env.PREVIEW != "false",
    ROOTURL = (PREVIEW? "https://preview.vainsocial.com/":"https://vainsocial.com/");

// tell the user that they need to store their name
module.exports.unknown = (msg) =>
    `You're unknown to our service. Try ${util.usg(msg, "vme")}.`;

module.exports.notFound = (ign) =>
    `Could not find ${ign}.`;

module.exports.noMatches = (ign) =>
    `Could not find any casual/ranked matches for ${ign}.`;

module.exports.tooFewMatches = (ign) =>
    `Could not find that many casual/ranked matches for ${ign}.`;

module.exports.loading = (ign) =>
    `Loading data for ${ign}…`;

module.exports.emojiCount = [ emoji.symbols.one, emoji.symbols.two, emoji.symbols.three,
    emoji.symbols.four, emoji.symbols.five, emoji.symbols.six,
    emoji.symbols.seven, emoji.symbols.eight, emoji.symbols.nine,
    emoji.symbols.ten
];

module.exports.profile = "Profile";
module.exports.lastMatch = "Last Match";

// based on impact score float, return an Emoji
module.exports.emojifyScore = (score) => {
    if (score > 0.7) return emoji.people.heart_eyes;
    if (score > 0.6) return emoji.people.blush;
    if (score > 0.5) return emoji.people.yum;
    if (score > 0.3) return emoji.people.relieved;
    return emoji.people.upside_down;
};
