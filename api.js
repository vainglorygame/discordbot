#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const request = require("request-promise"),
    Promise = require("bluebird"),
    WebSocket = require("ws"),
    webstomp = require("webstomp-client"),
    cacheManager = require("cache-manager"),
    sleep = require("sleep-promise"),
    Channel = require("async-csp").Channel;
const api = module.exports;

let cache = cacheManager.caching({
    store: "memory",
    ttl: 10  // s
});

const UPDATE_TIMEOUT = parseInt(process.env.UPDATE_TIMEOUT) || 60;  // s

const API_FE_URL = process.env.API_FE_URL || "http://vainsocial.bot/bot/api",
      API_MAP_URL = process.env.API_MAP_URL || "http://vainsocial.dev/masters/",
      API_WS_URL = process.env.API_WS_URL || "ws://vainsocial.dev/ws",
      API_BE_URL = process.env.API_BE_URL || "http://vainsocial.dev/bridge";

const notif = webstomp.over(new WebSocket(API_WS_URL,
    { perMessageDeflate: false }));

(function connect() {
    notif.connect("web", "web",
        () => console.log("connected to queue"),
        (err) => connect()
    );
})();

module.exports.getMap = async (url) => {
    return await request({
        uri: API_MAP_URL + url,
        json: true,
        forever: true
    });
}

module.exports.getFE = module.exports.get = async (url, params={}, ttl=60, cachekey=undefined) => {
    if (cachekey == undefined) cachekey = url + JSON.stringify(params);
    return await cache.wrap(cachekey, async () => await request({
        uri: API_FE_URL + url,
        qs: params,
        json: true,
        forever: true
    }), { ttl: ttl });
}

// send a POST and optionally bust cache
module.exports.postFE = module.exports.post = async (url, params={}, cachekey=undefined) => {
    if (cachekey) cache.del(cachekey);
    return await request.post(API_FE_URL + url, {
        form: params,
        json: true,
        forever: true
    });
}

module.exports.postBE = module.exports.backend = async (url) => {
    return await request.post({
        uri: API_BE_URL + url,
        json: true,
        forever: true
    });
}

function subscribe(topic, channel) {
    return notif.subscribe("/topic/" + topic, (msg) => {
        channel.put(msg.body);
        msg.ack();
    }, { ack: "client" });
}

// return id<->name mappings
module.exports.getMappings = async () => {
    return await cache.wrap("mappings", async () => {
        let mapping = new Map();
        await Promise.all([
            Promise.map(
                ["gamemode"], async (table) => {
                    mapping[table] = new Map();
                    (await api.getMap(table)).map(
                        (map) => mapping[table][map["id"]] = map["name"])
                }
            ),
            // name <-> API name
            Promise.map(
                ["hero"], async (table) => {
                    mapping[table] = new Map();
                    (await api.getMap(table)).map(
                        (map) => mapping[table][map["api_name"]] = map["name"])
                }
            )
        ]);
        return mapping;
    }, { ttl: 60 * 30 });
}

module.exports.mapGameMode = async (id) =>
    (await api.getMappings())["gamemode"][id];

module.exports.mapActor = async (api_name) =>
    (await api.getMappings())["hero"][api_name];

// return a set of IGN of supporters
module.exports.getGamers = async () =>
    (await api.getFE("/gamer", {}, 60 * 30)).map((gamer) => gamer.name);

// be an async iterator
// next() returns promises that are awaited until there is an update
module.exports.subscribeUpdates = (name, timeout=UPDATE_TIMEOUT) => {
    const channel = new Channel(),
        subscription = subscribe("player." + name, channel);

    // stop updates after timeout
    setTimeout(() => channel.close(), timeout*1000);

    let msg;
    return { next: async () => {
        do msg = await channel.take();
        while([Channel.DONE, "search_fail", "search_success",
            "stats_update", "matches_update"].indexOf(msg) == -1);
        // bust caches
        if (["stats_update"].indexOf(msg) != -1)
            cache.del("player+" + name);
        if (["matches_update"].indexOf(msg) != -1) {
            cache.del("matches+" + name);
            cache.del("player+" + name);
        }
        if (msg == "search_fail") {
            subscription.unsubscribe();
            throw { error: {
                err: "No player found for the provided IGN."
            } };
        }
        if (msg == Channel.DONE) {
            subscription.unsubscribe();
            return undefined;
        }
        return msg;
    } };
}

// search an unknown player
module.exports.searchPlayer = (name) =>
    api.postBE("/player/" + name + "/search");

// update a known player
module.exports.updatePlayer = (name) =>
    api.postBE("/player/" + name + "/update");

// return player
module.exports.getPlayer = async (name) => {
    return await api.getFE("/player/" + name, {}, 60, "player+" + name);
}

// search or update a player
module.exports.upsearchPlayer = async (name) => {
    try {
        await api.getPlayer(name);
        await api.updatePlayer(name);
    } catch (err) {
        await api.searchPlayer(name);
    }
}

// block until update is completely done
module.exports.upsearchPlayerSync = async (name) => {
    const waiter = await api.subscribeUpdates(name);
    await api.upsearchPlayer(name);
    let matchesUpdated = false, msg;
    while (await Promise.any([
        waiter.next(),
        sleep(2000)
    ]) != undefined);
}

// return matches
module.exports.getMatches = async (name) => {
    const data = await api.getFE("/player/" + name + "/matches/1.1.1.1", {},
        60 * 60, "matches+" + name);
    return data[0].data;
}

// return single match
module.exports.getMatch = async (id) => {
    return await api.getFE("/match/" + id, {}, 60 * 60);
}

// return a guild
module.exports.getGuild = async (token) => {
    return await api.getFE("/guild", { user_token: token }, 60, "guild+" + token);
}
// TODO! cache guilds by guild id, not by user token

// add user to guild
module.exports.addToGuild = async (token, member) => {
    const membership = await postFE("/guild/members", {
        user_token: token,
        member_name: member
    }, "guild+" + token);
    cache.del("guild+" + token);
    return membership;
}

// recalc fame, block until timeout or points update
module.exports.calculateGuild = async (id, token) => {
    const channel = new Channel(),
        subscription = subscribe("global", channel);
    await api.backend("/team/" + id + "/crunch");

    // stop updates after timeout
    setTimeout(() => channel.close(), UPDATE_TIMEOUT*1000);

    let msg;
    do msg = await channel.take();
    while([Channel.DONE, "points_update"].indexOf(msg) == -1);

    if (msg == "points_update") cache.del("guild+" + token);
    subscription.unsubscribe();
}

// store Discord ID <-> IGN
module.exports.setUser = async (token, name) => {
    cache.del("user+" + token);
    await api.post("/user", {
        name: name,
        user_token: token
    });
}

// retrieve Discord ID -> IGN
module.exports.getUser = async (token) => {
    const user = await api.getFE("/user", { user_token: token }, 60, "user+" + token);
    return user.name;
}
