#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const emoji = require("discord-emoji"),
    View = require("./view"),
    MatchView = require("./match"),
    MatchesView = require("./matches"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const PREVIEW = process.env.PREVIEW != "false",
    ROOTURL = (PREVIEW? "https://preview.vainsocial.com/":"https://vainsocial.com/");

const PlayerView = module.exports;

// player profile
module.exports = class extends View {
    constructor(msg, ign) {
        super(msg);
        this.ign = ign;
    }

    async text(player) {
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
            picks = oneLine`Favorite | \`${hero}\`, \`${player.picks[0].hero_pick} picks\``;
        }
        return `
${stats}
${total_kda}
${best_hero}
${picks}
        `;
    }

    async embed(player, matches) {
        return util.vainsocialEmbed(`${player.name} - ${player.shard_id}`, "player/" + player.name, "vainsocial-user")
            .setThumbnail(ROOTURL + "images/game/skill_tiers/" +
                matches[0].skill_tier + ".png")
            .setDescription("")
            .addField(strings.profile, await this.text(player), true)
            .addField(strings.lastMatch, await new MatchesView().text(matches[0]) +
                "\n" + await this.help(), true)
            .setTimestamp(new Date(matches[0].created_at));
    };

    async help() {
        return oneLine`
*${emoji.symbols.information_source} or ${util.usg(this.msg, "vm " + this.ign)} for detail,
${emoji.symbols["1234"]} or ${util.usg(this.msg, "vh " + this.ign)} for more*`;
    }

    async buttons(player, matches) {
        let reactions = {};
        reactions[emoji.symbols.information_source] = async () => {
            util.trackAction(this.msg, "reaction-match", player.name);
            await new MatchView(this.msg, matches[0].match_api_id).respond();
        };
        reactions[emoji.symbols["1234"]] = async () => {
            util.trackAction(this.msg, "reaction-matches", player.name);
            await new MatchesView(this.msg, player.name).respond();
        };
        return reactions;
    }

    async respond() {
        const [player, matches] = await Promise.all([
            api.getPlayer(this.ign),
            api.getMatches(this.ign)
        ]);
        if (player == undefined) {
            this.response = await util.respond(this.msg,
                strings.loading(this.ign), this.response);
            return this.response;
        }
        if (matches.length == 0) {
            this.response = await util.respond(this.msg,
                strings.loading(this.ign), this.response);
            return this.response;
        }
        this.response = await util.respond(this.msg,
            await this.embed(player, matches), this.response);
        if (!this.hasButtons) {
            await util.reactionButtons(this.response,
                await this.buttons(player, matches));
            this.hasButtons = true;
        }
        return this.response;
    }
}
