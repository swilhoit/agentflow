"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var Logger = /** @class */ (function () {
    function Logger() {
        this.level = LogLevel.INFO;
    }
    Logger.prototype.setLevel = function (level) {
        this.level = level;
    };
    Logger.prototype.debug = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (this.level <= LogLevel.DEBUG) {
            console.debug.apply(console, __spreadArray(["[DEBUG] ".concat(new Date().toISOString(), " - ").concat(message)], args, false));
        }
    };
    Logger.prototype.info = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (this.level <= LogLevel.INFO) {
            console.log.apply(console, __spreadArray(["[INFO] ".concat(new Date().toISOString(), " - ").concat(message)], args, false));
        }
    };
    Logger.prototype.warn = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (this.level <= LogLevel.WARN) {
            console.warn.apply(console, __spreadArray(["[WARN] ".concat(new Date().toISOString(), " - ").concat(message)], args, false));
        }
    };
    Logger.prototype.error = function (message, error) {
        if (this.level <= LogLevel.ERROR) {
            console.error("[ERROR] ".concat(new Date().toISOString(), " - ").concat(message), error);
        }
    };
    return Logger;
}());
exports.logger = new Logger();
