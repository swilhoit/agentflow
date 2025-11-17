"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrelloService = void 0;
var axios_1 = require("axios");
var logger_1 = require("../utils/logger");
var TrelloService = /** @class */ (function () {
    function TrelloService(apiKey, apiToken) {
        this.baseUrl = 'https://api.trello.com/1';
        if (!apiKey || !apiToken) {
            throw new Error('Trello API key and token are required');
        }
        this.apiKey = apiKey;
        this.apiToken = apiToken;
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            params: {
                key: this.apiKey,
                token: this.apiToken
            }
        });
        logger_1.logger.info('TrelloService initialized');
    }
    // ==================== BOARDS ====================
    /**
     * Get all boards for the authenticated user
     */
    TrelloService.prototype.getBoards = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get('/members/me/boards')];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved ".concat(response.data.length, " boards"));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_1 = _a.sent();
                        logger_1.logger.error('Error fetching boards:', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a specific board by ID
     */
    TrelloService.prototype.getBoard = function (boardId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/boards/".concat(boardId), {
                                params: { lists: 'open' }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved board: ".concat(response.data.name));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_2 = _a.sent();
                        logger_1.logger.error("Error fetching board ".concat(boardId, ":"), error_2);
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new board
     */
    TrelloService.prototype.createBoard = function (name, desc) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post('/boards', null, {
                                params: { name: name, desc: desc }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Created board: ".concat(response.data.name, " (").concat(response.data.id, ")"));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_3 = _a.sent();
                        logger_1.logger.error('Error creating board:', error_3);
                        throw error_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== LISTS ====================
    /**
     * Get all lists on a board
     */
    TrelloService.prototype.getLists = function (boardId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/boards/".concat(boardId, "/lists"))];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved ".concat(response.data.length, " lists from board ").concat(boardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_4 = _a.sent();
                        logger_1.logger.error("Error fetching lists for board ".concat(boardId, ":"), error_4);
                        throw error_4;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a specific list by ID
     */
    TrelloService.prototype.getList = function (listId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/lists/".concat(listId))];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved list: ".concat(response.data.name));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_5 = _a.sent();
                        logger_1.logger.error("Error fetching list ".concat(listId, ":"), error_5);
                        throw error_5;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new list on a board
     */
    TrelloService.prototype.createList = function (name, boardId, pos) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post('/lists', null, {
                                params: { name: name, idBoard: boardId, pos: pos }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Created list: ".concat(response.data.name, " (").concat(response.data.id, ")"));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_6 = _a.sent();
                        logger_1.logger.error('Error creating list:', error_6);
                        throw error_6;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== CARDS ====================
    /**
     * Create a new card
     */
    TrelloService.prototype.createCard = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post('/cards', null, {
                                params: options
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Created card: ".concat(response.data.name, " (").concat(response.data.id, ")"));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_7 = _a.sent();
                        logger_1.logger.error('Error creating card:', error_7);
                        throw error_7;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a specific card by ID
     */
    TrelloService.prototype.getCard = function (cardId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/cards/".concat(cardId), {
                                params: {
                                    fields: 'all',
                                    labels: true,
                                    members: true
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved card: ".concat(response.data.name));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_8 = _a.sent();
                        logger_1.logger.error("Error fetching card ".concat(cardId, ":"), error_8);
                        throw error_8;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update an existing card
     */
    TrelloService.prototype.updateCard = function (cardId, options) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.put("/cards/".concat(cardId), null, {
                                params: options
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Updated card: ".concat(response.data.name, " (").concat(cardId, ")"));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_9 = _a.sent();
                        logger_1.logger.error("Error updating card ".concat(cardId, ":"), error_9);
                        throw error_9;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete a card
     */
    TrelloService.prototype.deleteCard = function (cardId) {
        return __awaiter(this, void 0, void 0, function () {
            var error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.delete("/cards/".concat(cardId))];
                    case 1:
                        _a.sent();
                        logger_1.logger.info("Deleted card: ".concat(cardId));
                        return [3 /*break*/, 3];
                    case 2:
                        error_10 = _a.sent();
                        logger_1.logger.error("Error deleting card ".concat(cardId, ":"), error_10);
                        throw error_10;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all cards on a list
     */
    TrelloService.prototype.getCardsOnList = function (listId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/lists/".concat(listId, "/cards"))];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved ".concat(response.data.length, " cards from list ").concat(listId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_11 = _a.sent();
                        logger_1.logger.error("Error fetching cards for list ".concat(listId, ":"), error_11);
                        throw error_11;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all cards on a board
     */
    TrelloService.prototype.getCardsOnBoard = function (boardId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/boards/".concat(boardId, "/cards"))];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved ".concat(response.data.length, " cards from board ").concat(boardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_12 = _a.sent();
                        logger_1.logger.error("Error fetching cards for board ".concat(boardId, ":"), error_12);
                        throw error_12;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Search for cards
     */
    TrelloService.prototype.searchCards = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var params, response, cards, error_13;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        params = {
                            query: options.query,
                            modelTypes: ((_a = options.modelTypes) === null || _a === void 0 ? void 0 : _a.join(',')) || 'cards',
                            partial: (_b = options.partial) !== null && _b !== void 0 ? _b : true
                        };
                        if (options.idBoards) {
                            params.idBoards = options.idBoards.join(',');
                        }
                        if (options.idLists) {
                            params.idLists = options.idLists.join(',');
                        }
                        return [4 /*yield*/, this.client.get('/search', { params: params })];
                    case 1:
                        response = _c.sent();
                        cards = response.data.cards || [];
                        logger_1.logger.info("Found ".concat(cards.length, " cards matching query: ").concat(options.query));
                        return [2 /*return*/, cards];
                    case 2:
                        error_13 = _c.sent();
                        logger_1.logger.error('Error searching cards:', error_13);
                        throw error_13;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Move a card to a different list
     */
    TrelloService.prototype.moveCard = function (cardId, listId, pos) {
        return __awaiter(this, void 0, void 0, function () {
            var error_14;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.updateCard(cardId, { idList: listId, pos: pos })];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_14 = _a.sent();
                        logger_1.logger.error("Error moving card ".concat(cardId, " to list ").concat(listId, ":"), error_14);
                        throw error_14;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Archive a card
     */
    TrelloService.prototype.archiveCard = function (cardId) {
        return __awaiter(this, void 0, void 0, function () {
            var error_15;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.updateCard(cardId, { closed: true })];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_15 = _a.sent();
                        logger_1.logger.error("Error archiving card ".concat(cardId, ":"), error_15);
                        throw error_15;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== CARD DETAILS ====================
    /**
     * Add a comment to a card
     */
    TrelloService.prototype.addComment = function (cardId, text) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_16;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post("/cards/".concat(cardId, "/actions/comments"), null, {
                                params: { text: text }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Added comment to card ".concat(cardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_16 = _a.sent();
                        logger_1.logger.error("Error adding comment to card ".concat(cardId, ":"), error_16);
                        throw error_16;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all comments on a card
     */
    TrelloService.prototype.getComments = function (cardId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_17;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/cards/".concat(cardId, "/actions"), {
                                params: { filter: 'commentCard' }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved ".concat(response.data.length, " comments from card ").concat(cardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_17 = _a.sent();
                        logger_1.logger.error("Error fetching comments for card ".concat(cardId, ":"), error_17);
                        throw error_17;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Add an attachment to a card
     */
    TrelloService.prototype.addAttachment = function (cardId, url, name) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_18;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post("/cards/".concat(cardId, "/attachments"), null, {
                                params: { url: url, name: name }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Added attachment to card ".concat(cardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_18 = _a.sent();
                        logger_1.logger.error("Error adding attachment to card ".concat(cardId, ":"), error_18);
                        throw error_18;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== LABELS ====================
    /**
     * Get all labels on a board
     */
    TrelloService.prototype.getLabels = function (boardId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_19;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/boards/".concat(boardId, "/labels"))];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved ".concat(response.data.length, " labels from board ").concat(boardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_19 = _a.sent();
                        logger_1.logger.error("Error fetching labels for board ".concat(boardId, ":"), error_19);
                        throw error_19;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new label on a board
     */
    TrelloService.prototype.createLabel = function (boardId, name, color) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_20;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post('/labels', null, {
                                params: { idBoard: boardId, name: name, color: color }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Created label: ".concat(response.data.name, " (").concat(response.data.id, ")"));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_20 = _a.sent();
                        logger_1.logger.error('Error creating label:', error_20);
                        throw error_20;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Add a label to a card
     */
    TrelloService.prototype.addLabelToCard = function (cardId, labelId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_21;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post("/cards/".concat(cardId, "/idLabels"), null, {
                                params: { value: labelId }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Added label ".concat(labelId, " to card ").concat(cardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_21 = _a.sent();
                        logger_1.logger.error("Error adding label to card ".concat(cardId, ":"), error_21);
                        throw error_21;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== MEMBERS ====================
    /**
     * Get all members on a board
     */
    TrelloService.prototype.getBoardMembers = function (boardId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_22;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get("/boards/".concat(boardId, "/members"))];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Retrieved ".concat(response.data.length, " members from board ").concat(boardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_22 = _a.sent();
                        logger_1.logger.error("Error fetching members for board ".concat(boardId, ":"), error_22);
                        throw error_22;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Add a member to a card
     */
    TrelloService.prototype.addMemberToCard = function (cardId, memberId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_23;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post("/cards/".concat(cardId, "/idMembers"), null, {
                                params: { value: memberId }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Added member ".concat(memberId, " to card ").concat(cardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_23 = _a.sent();
                        logger_1.logger.error("Error adding member to card ".concat(cardId, ":"), error_23);
                        throw error_23;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Remove a member from a card
     */
    TrelloService.prototype.removeMemberFromCard = function (cardId, memberId) {
        return __awaiter(this, void 0, void 0, function () {
            var error_24;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.delete("/cards/".concat(cardId, "/idMembers/").concat(memberId))];
                    case 1:
                        _a.sent();
                        logger_1.logger.info("Removed member ".concat(memberId, " from card ").concat(cardId));
                        return [3 /*break*/, 3];
                    case 2:
                        error_24 = _a.sent();
                        logger_1.logger.error("Error removing member from card ".concat(cardId, ":"), error_24);
                        throw error_24;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== CHECKLISTS ====================
    /**
     * Add a checklist to a card
     */
    TrelloService.prototype.addChecklist = function (cardId, name) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_25;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post("/cards/".concat(cardId, "/checklists"), null, {
                                params: { name: name }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Added checklist \"".concat(name, "\" to card ").concat(cardId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_25 = _a.sent();
                        logger_1.logger.error("Error adding checklist to card ".concat(cardId, ":"), error_25);
                        throw error_25;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Add an item to a checklist
     */
    TrelloService.prototype.addChecklistItem = function (checklistId, name, checked) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_26;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.post("/checklists/".concat(checklistId, "/checkItems"), null, {
                                params: { name: name, checked: checked }
                            })];
                    case 1:
                        response = _a.sent();
                        logger_1.logger.info("Added item \"".concat(name, "\" to checklist ").concat(checklistId));
                        return [2 /*return*/, response.data];
                    case 2:
                        error_26 = _a.sent();
                        logger_1.logger.error("Error adding item to checklist ".concat(checklistId, ":"), error_26);
                        throw error_26;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== UTILITY METHODS ====================
    /**
     * Find a list by name on a board
     */
    TrelloService.prototype.findListByName = function (boardId, listName) {
        return __awaiter(this, void 0, void 0, function () {
            var lists, error_27;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getLists(boardId)];
                    case 1:
                        lists = _a.sent();
                        return [2 /*return*/, lists.find(function (list) { return list.name.toLowerCase() === listName.toLowerCase(); }) || null];
                    case 2:
                        error_27 = _a.sent();
                        logger_1.logger.error("Error finding list by name on board ".concat(boardId, ":"), error_27);
                        throw error_27;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Find a board by name
     */
    TrelloService.prototype.findBoardByName = function (boardName) {
        return __awaiter(this, void 0, void 0, function () {
            var boards, error_28;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getBoards()];
                    case 1:
                        boards = _a.sent();
                        return [2 /*return*/, boards.find(function (board) { return board.name.toLowerCase() === boardName.toLowerCase(); }) || null];
                    case 2:
                        error_28 = _a.sent();
                        logger_1.logger.error('Error finding board by name:', error_28);
                        throw error_28;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get or create a board
     */
    TrelloService.prototype.getOrCreateBoard = function (boardName, desc) {
        return __awaiter(this, void 0, void 0, function () {
            var existingBoard, error_29;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.findBoardByName(boardName)];
                    case 1:
                        existingBoard = _a.sent();
                        if (existingBoard) {
                            logger_1.logger.info("Found existing board: ".concat(boardName));
                            return [2 /*return*/, existingBoard];
                        }
                        logger_1.logger.info("Creating new board: ".concat(boardName));
                        return [4 /*yield*/, this.createBoard(boardName, desc)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_29 = _a.sent();
                        logger_1.logger.error('Error in getOrCreateBoard:', error_29);
                        throw error_29;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get or create a list on a board
     */
    TrelloService.prototype.getOrCreateList = function (boardId, listName) {
        return __awaiter(this, void 0, void 0, function () {
            var existingList, error_30;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.findListByName(boardId, listName)];
                    case 1:
                        existingList = _a.sent();
                        if (existingList) {
                            logger_1.logger.info("Found existing list: ".concat(listName));
                            return [2 /*return*/, existingList];
                        }
                        logger_1.logger.info("Creating new list: ".concat(listName));
                        return [4 /*yield*/, this.createList(listName, boardId)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_30 = _a.sent();
                        logger_1.logger.error('Error in getOrCreateList:', error_30);
                        throw error_30;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return TrelloService;
}());
exports.TrelloService = TrelloService;
