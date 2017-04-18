#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const request = require("request-promise-native"),
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

const API_FE_URL = process.env.API_FE_URL || "http://vainsocial.dev/bots/api",
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

// TODO use keepalive / connection pool
function getMap(url) {
    return request({
        uri: API_MAP_URL + url,
        json: true
    });
}

function getFE(url) {
    return request({
        uri: API_FE_URL + url,
        json: true
    });
}

function postBE(url) {
    return request.post({
        uri: API_BE_URL + url,
        json: true
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
        await Promise.map(
            ["gamemode"], async (table) => {
                mapping[table] = new Map();
                (await getMap(table)).map(
                    (map) => mapping[table][map["id"]] = map["name"])
            }
        );
        return mapping;
    });
}

module.exports.mapGameMode = async function(id) {
    return (await getMappings())["gamemode"][id];
}

// be an async iterator
// next() returns promises that are awaited until there is an update
module.exports.subscribeUpdates = function(name, timeout=UPDATE_TIMEOUT) {
    const channel = new Channel(),
        subscription = subscribe("player." + name, channel);

    // stop updates after timeout
    setTimeout(() => channel.close(), timeout*1000);

    let msg;
    return { next: async function () {
        if (this._first) {
            this._first = false;
            await postBE("/player/" + name + "/update");
            return true;
        }
        do {
            msg = await channel.take();
        } while([Channel.DONE, "initial", "search_fail",
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
        return true;
    }, _first: true };
}

// return player
module.exports.getPlayer = async function(name) {
    return await cache.wrap("player+" + name, async () => {
        try {
            return await getFE("/player/" + name);
        } catch (err) {
            return undefined;
        }
    }, { ttl: 60 });
}

// return matches
module.exports.getMatches = async function(name) {
    return await cache.wrap("matches+" + name, async () => {
        try {
            return await getFE("/player/" + name + "/matches/1.1.1.1");
        } catch (err) {
            return undefined;
        }
    }, { ttl: 60 });
}

// return single match
module.exports.getMatch = async function(id) {
    return await cache.wrap("match+" + id, async () =>
        getFE("/match/" + id),
    { ttl: 60 * 60 });
}
