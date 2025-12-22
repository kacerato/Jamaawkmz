"use strict";
// src/utils/calculations.ts
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractConnectionsFromPoints = exports.embedConnectionsInPoints = exports.calculateTotalProjectDistance = exports.calculateDistance = void 0;
var R_EARTH = 6378137; // Earth Radius (WGS-84)
/**
 * Calculates the Haversine distance between two coordinates in meters.
 */
var calculateDistance = function (lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined)
        return 0;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
exports.calculateDistance = calculateDistance;
/**
 * Calculates the total project distance, respecting "vãos" (spans) multiplier.
 * Standardizes the calculation across the entire app.
 */
var calculateTotalProjectDistance = function (points, extraConnections) {
    if (extraConnections === void 0) { extraConnections = []; }
    if (!points || points.length < 2)
        return 0;
    var totalDistance = 0;
    var pointMap = new Map();
    points.forEach(function (p) { return pointMap.set(String(p.id), p); }); // Force string keys for consistency
    // 1. Main Tree Distance (Branches + Sequential)
    for (var i = 0; i < points.length; i++) {
        var point = points[i];
        // Determine the "parent" point (where this point connects FROM)
        var parent_1 = void 0;
        if (point.connectedFrom !== null && point.connectedFrom !== undefined) {
            // Explicit branching
            parent_1 = pointMap.get(String(point.connectedFrom));
        }
        else if (i > 0 && !point.isGap) {
            // Implicit sequential connection (default behavior if no branching logic is active)
            // Checks if the previous point exists and is not a "gap" (start of a new disconnected segment)
            parent_1 = points[i - 1];
        }
        if (parent_1) {
            var dist = calculateDistance(parent_1.lat, parent_1.lng, point.lat, point.lng);
            // APPLY SPANS (Vãos)
            // The 'spans' property is on the *target* point (the end of the segment).
            var spans = point.spans ? Number(point.spans) : 1;
            var multiplier = isNaN(spans) ? 1 : spans;
            totalDistance += (dist * multiplier);
        }
    }
    // 2. Extra Connections (Loops)
    if (Array.isArray(extraConnections)) {
        for (var _i = 0, extraConnections_1 = extraConnections; _i < extraConnections_1.length; _i++) {
            var conn = extraConnections_1[_i];
            var p1 = pointMap.get(String(conn.fromId));
            var p2 = pointMap.get(String(conn.toId));
            if (p1 && p2) {
                var dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
                var spans = conn.spans ? Number(conn.spans) : 1;
                var multiplier = isNaN(spans) ? 1 : spans;
                totalDistance += (dist * multiplier);
            }
        }
    }
    return totalDistance;
};
exports.calculateTotalProjectDistance = calculateTotalProjectDistance;
/**
 * Merges extra_connections into the points array as a special property to persist data
 * without needing a separate SQL column.
 *
 * Strategy: Store outgoing extra connections on the 'from' point.
 */
var embedConnectionsInPoints = function (points, extraConnections) {
    if (!extraConnections || extraConnections.length === 0)
        return points;
    // Deep copy to avoid mutating state directly
    var newPoints = points.map(function (p) { return (__assign(__assign({}, p), { _extraConnections: [] })); });
    extraConnections.forEach(function (conn) {
        var sourcePoint = newPoints.find(function (p) { return String(p.id) === String(conn.fromId); });
        if (sourcePoint) {
            if (!sourcePoint._extraConnections)
                sourcePoint._extraConnections = [];
            sourcePoint._extraConnections.push(conn);
        }
    });
    return newPoints;
};
exports.embedConnectionsInPoints = embedConnectionsInPoints;
/**
 * Extracts extra_connections from the points array (restoring state from DB).
 */
var extractConnectionsFromPoints = function (points) {
    if (!points)
        return [];
    var connections = [];
    points.forEach(function (p) {
        if (p._extraConnections && Array.isArray(p._extraConnections)) {
            connections.push.apply(connections, p._extraConnections);
        }
    });
    return connections;
};
exports.extractConnectionsFromPoints = extractConnectionsFromPoints;
