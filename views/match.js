#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const View = require("./view"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const PREVIEW = process.env.PREVIEW != "false",
    ROOTURL = (PREVIEW? "https://preview.vainsocial.com/":"https://vainsocial.com/");

const MatchView = module.exports;

// match detail view
module.exports = class extends View {
    // return [[title, text], …] for rosters
    async text(match) {
        let resps = [];
        for(let roster of match.rosters) {
            let winstr = "Won";
            if (!roster.winner) winstr = "Lost";
            let rosterstr = `${roster.side} - \`${roster.hero_kills}\` Kills - ${winstr}`;
            let teamstr = "";
            for(let participant of roster.participants) {
                const hero = await api.mapActor(participant.actor),
                    emojiScore = strings.emojifyScore(participant.stats.impact_score);
                teamstr += `
\`${hero}\`, [${participant.player.name}](${ROOTURL}player/${participant.player.name}${util.track("match-detail")}) \`T${Math.floor(participant.skill_tier/3+1)}\` | \`${participant.stats.kills}/${participant.stats.deaths}/${participant.stats.assists}\`, \`${Math.floor(participant.stats.farm)}\`, Score ${emojiScore} \`${Math.floor(100 * participant.stats.impact_score)}%\``;
            }
            resps.push([rosterstr, teamstr]);
        }
        return resps;
    }

    async embed(match) {
        let embed = util.vainsocialEmbed(`${match.game_mode}, ${match.duration} minutes`,
            "matches/" + match.api_id , "vainsocial-match")
            .setTimestamp(new Date(match.created_at));
        (await this.text(match)).forEach(([title, text]) => {
            embed.addField(title, text, true);
        });
        return embed;
    };

    async respond(matchid) {
        const match = await api.getMatch(matchid);
        this.response = await util.respond(this.msg,
            await this.embed(match), this.response);
        return this.response;
    };
}
