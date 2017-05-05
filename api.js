#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const request = require("request-promise"),
    Promise = require("bluebird"),
    WebSocket = require("ws"),
    webstomp = require("webstomp-client"),
    cacheManager = require("cache-manager"),
    Channel = require("async-csp").Channel;

let cache = cacheManager.caching({
    store: "memory",
    ttl: 10  // s
});

const UPDATE_TIMEOUT = parseInt(process.env.UPDATE_TIMEOUT) || 60;  // s

const API_FE_URL = process.env.API_FE_URL || "http://vainsocial.dev/bot/api",
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

function getMap(url) {
    return request({
        uri: API_MAP_URL + url,
        json: true,
        forever: true
    });
}

async function getFE(url, params={}, ttl=60, cachekey=undefined) {
    if (cachekey == undefined) cachekey = url + JSON.stringify(params);
    return await cache.wrap(cachekey, async () => {
        try {
            return await request({
                uri: API_FE_URL + url,
                qs: params,
                json: true,
                forever: true
            });
        } catch (err) {
            return undefined;
        }
    }, { ttl: ttl });
}

async function postFE(url, params={}) {
    return await request.post(API_FE_URL + url, {
        form: params,
        json: true,
        forever: true
    });
}

module.exports.get = getFE;
module.exports.post = postFE;

function postBE(url) {
    return request.post({
        uri: API_BE_URL + url,
        json: true,
        forever: true
    });
}

function subscribe(topic, channel) {
    return notif.subscribe("/topic/" + topic, (msg) => {
        channel.put(msg.body);
        msg.ack();
    }, {"ack": "client"});
}

// return id<->name mappings
async function getMappings() {
    return await cache.wrap("mappings", async () => {
        let mapping = new Map();
        await Promise.all([
            Promise.map(
                ["gamemode"], async (table) => {
                    mapping[table] = new Map();
                    (await getMap(table)).map(
                        (map) => mapping[table][map["id"]] = map["name"])
                }
            ),
            // name <-> API name
            Promise.map(
                ["hero"], async (table) => {
                    mapping[table] = new Map();
                    (await getMap(table)).map(
                        (map) => mapping[table][map["api_name"]] = map["name"])
                }
            )
        ]);
        return mapping;
    }, { ttl: 60 * 30 });
}

module.exports.mapGameMode = async (id) =>
    (await getMappings())["gamemode"][id];

module.exports.mapActor = async (api_name) =>
    (await getMappings())["hero"][api_name];

// return a set of IGN of supporters
module.exports.getGamers = async () =>
    (await getFE("/gamer", {}, 60 * 30)).map((gamer) => gamer.name);

// be an async iterator
// next() returns promises that are awaited until there is an update
module.exports.subscribeUpdates = async (name, refresh=true, timeout=UPDATE_TIMEOUT) => {
    const channel = new Channel(),
        subscription = subscribe("player." + name, channel);

    if (refresh) {
        // trigger backend
        if (await module.exports.getPlayer(name) == undefined)
            await module.exports.searchPlayer(name);
        else await module.exports.updatePlayer(name);
    }

    // stop updates after timeout
    setTimeout(() => channel.close(), timeout*1000);

    let msg;
    return { next: async function () {
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
        if ([Channel.DONE, "search_fail"].indexOf(msg) != -1) {
            subscription.unsubscribe();
            return undefined;
        }
        return msg;
    } };
}

// search an unknown player
module.exports.searchPlayer = (name) =>
    postBE("/player/" + name + "/search");

// update a known player
module.exports.updatePlayer = (name) =>
    postBE("/player/" + name + "/update");

// return player
module.exports.getPlayer = (name) =>
    getFE("/player/" + name, {}, 60, "player+" + name);

// return matches
module.exports.getMatches = async (name) => {
    const data = await getFE("/player/" + name + "/matches/2.3.1.1", {},
        60 * 60, "matches+" + name);
    if (data == undefined) return [];
    return data[0].data;
}

// return single match
module.exports.getMatch = (id) =>
    getFE("/match/" + id, {}, 60 * 60);
