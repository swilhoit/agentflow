"use strict";
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
exports.ToolBasedAgent = void 0;
var sdk_1 = require("@anthropic-ai/sdk");
var child_process_1 = require("child_process");
var util_1 = require("util");
var logger_1 = require("../utils/logger");
var taskDecomposer_1 = require("../utils/taskDecomposer");
var smartIterationCalculator_1 = require("../utils/smartIterationCalculator");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Tool-based Agent using native Anthropic Tool Use API
 *
 * This is the same approach Claude Code/Cursor uses - no external CLI needed!
 * Claude directly calls tools, sees results, and iterates until task is complete.
 */
var ToolBasedAgent = /** @class */ (function () {
    function ToolBasedAgent(apiKey, trelloService) {
        this.maxIterations = 15;
        this.client = new sdk_1.default({ apiKey: apiKey });
        this.trelloService = trelloService;
        this.taskDecomposer = new taskDecomposer_1.TaskDecomposer(apiKey);
    }
    ToolBasedAgent.prototype.setNotificationHandler = function (handler) {
        this.notificationHandler = handler;
    };
    ToolBasedAgent.prototype.notify = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.notificationHandler) return [3 /*break*/, 5];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        logger_1.logger.info("\uD83D\uDCE2 Sending notification: ".concat(message.substring(0, 100), "..."));
                        return [4 /*yield*/, this.notificationHandler(message)];
                    case 2:
                        _a.sent();
                        logger_1.logger.info('✅ Notification sent successfully');
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        logger_1.logger.error('❌ Failed to send notification', error_1);
                        logger_1.logger.error('Notification content:', message);
                        return [3 /*break*/, 4];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        logger_1.logger.error('⚠️⚠️⚠️ NO NOTIFICATION HANDLER SET - USER WILL NOT SEE THIS! ⚠️⚠️⚠️');
                        logger_1.logger.error('Message that should have been sent to user:', message);
                        logger_1.logger.error('This indicates a serious configuration error - notifications are critical for UX!');
                        _a.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Define available tools
     */
    ToolBasedAgent.prototype.getTools = function () {
        var tools = [
            {
                name: 'execute_bash',
                description: 'Execute a bash command and return the output. Use this for file operations, git commands, npm, etc.',
                input_schema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'The bash command to execute'
                        }
                    },
                    required: ['command']
                }
            }
        ];
        // Add Trello tools if service is available
        if (this.trelloService) {
            tools.push({
                name: 'trello_list_boards',
                description: 'List all Trello boards',
                input_schema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }, {
                name: 'trello_get_board',
                description: 'Get a specific Trello board by name',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board to find'
                        }
                    },
                    required: ['boardName']
                }
            }, {
                name: 'trello_create_list',
                description: 'Create a new list on a Trello board',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board'
                        },
                        listName: {
                            type: 'string',
                            description: 'Name for the new list'
                        }
                    },
                    required: ['boardName', 'listName']
                }
            }, {
                name: 'trello_create_card',
                description: 'Create a new card on a Trello list',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board'
                        },
                        listName: {
                            type: 'string',
                            description: 'Name of the list to add the card to'
                        },
                        cardName: {
                            type: 'string',
                            description: 'Title of the card'
                        },
                        description: {
                            type: 'string',
                            description: 'Description for the card (optional)'
                        }
                    },
                    required: ['boardName', 'listName', 'cardName']
                }
            }, {
                name: 'trello_list_cards',
                description: 'List all cards on a Trello board',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board'
                        }
                    },
                    required: ['boardName']
                }
            }, {
                name: 'trello_update_card',
                description: 'Update an existing Trello card (name, description, due date, list, position, labels, members)',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board containing the card'
                        },
                        cardName: {
                            type: 'string',
                            description: 'Current name of the card to update'
                        },
                        newName: {
                            type: 'string',
                            description: 'New name for the card (optional)'
                        },
                        newDescription: {
                            type: 'string',
                            description: 'New description for the card (optional)'
                        },
                        newListName: {
                            type: 'string',
                            description: 'Name of list to move card to (optional)'
                        },
                        dueDate: {
                            type: 'string',
                            description: 'Due date in ISO format (optional)'
                        }
                    },
                    required: ['boardName', 'cardName']
                }
            }, {
                name: 'trello_get_lists',
                description: 'Get all lists on a Trello board',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board'
                        }
                    },
                    required: ['boardName']
                }
            }, {
                name: 'trello_search_cards',
                description: 'Search for cards across boards by text query',
                input_schema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query text'
                        },
                        boardName: {
                            type: 'string',
                            description: 'Optional board name to limit search to'
                        }
                    },
                    required: ['query']
                }
            }, {
                name: 'trello_add_comment',
                description: 'Add a comment to a Trello card',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board'
                        },
                        cardName: {
                            type: 'string',
                            description: 'Name of the card to comment on'
                        },
                        comment: {
                            type: 'string',
                            description: 'Comment text to add'
                        }
                    },
                    required: ['boardName', 'cardName', 'comment']
                }
            }, {
                name: 'trello_archive_card',
                description: 'Archive (close) a Trello card',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board'
                        },
                        cardName: {
                            type: 'string',
                            description: 'Name of the card to archive'
                        }
                    },
                    required: ['boardName', 'cardName']
                }
            }, {
                name: 'trello_add_checklist',
                description: 'Add a checklist to a Trello card',
                input_schema: {
                    type: 'object',
                    properties: {
                        boardName: {
                            type: 'string',
                            description: 'Name of the board'
                        },
                        cardName: {
                            type: 'string',
                            description: 'Name of the card'
                        },
                        checklistName: {
                            type: 'string',
                            description: 'Name for the checklist'
                        },
                        items: {
                            type: 'array',
                            description: 'Array of checklist item names (optional)',
                            items: {
                                type: 'string'
                            }
                        }
                    },
                    required: ['boardName', 'cardName', 'checklistName']
                }
            });
        }
        return tools;
    };
    /**
     * Execute a tool call
     */
    ToolBasedAgent.prototype.executeTool = function (toolName, toolInput) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_2, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        logger_1.logger.info("\uD83D\uDD27 Executing tool: ".concat(toolName));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 17, , 18]);
                        _a = toolName;
                        switch (_a) {
                            case 'execute_bash': return [3 /*break*/, 2];
                            case 'trello_list_boards': return [3 /*break*/, 4];
                            case 'trello_get_board': return [3 /*break*/, 6];
                            case 'trello_create_list': return [3 /*break*/, 8];
                            case 'trello_create_card': return [3 /*break*/, 10];
                            case 'trello_list_cards': return [3 /*break*/, 12];
                            case 'trello_update_card': return [3 /*break*/, 14];
                            case 'trello_get_lists': return [3 /*break*/, 14];
                            case 'trello_search_cards': return [3 /*break*/, 14];
                            case 'trello_add_comment': return [3 /*break*/, 14];
                            case 'trello_archive_card': return [3 /*break*/, 14];
                            case 'trello_add_checklist': return [3 /*break*/, 14];
                        }
                        return [3 /*break*/, 15];
                    case 2: return [4 /*yield*/, this.executeBash(toolInput.command)];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4: return [4 /*yield*/, this.trelloListBoards()];
                    case 5: return [2 /*return*/, _b.sent()];
                    case 6: return [4 /*yield*/, this.trelloGetBoard(toolInput.boardName)];
                    case 7: return [2 /*return*/, _b.sent()];
                    case 8: return [4 /*yield*/, this.trelloCreateList(toolInput.boardName, toolInput.listName)];
                    case 9: return [2 /*return*/, _b.sent()];
                    case 10: return [4 /*yield*/, this.trelloCreateCard(toolInput.boardName, toolInput.listName, toolInput.cardName, toolInput.description)];
                    case 11: return [2 /*return*/, _b.sent()];
                    case 12: return [4 /*yield*/, this.trelloListCards(toolInput.boardName)];
                    case 13: return [2 /*return*/, _b.sent()];
                    case 14: return [2 /*return*/, {
                            success: false,
                            error: "Tool '".concat(toolName, "' not yet implemented. Use execute_bash with curl or Trello API for advanced operations."),
                            suggestion: "Example: execute_bash(\"curl -X GET 'https://api.trello.com/1/boards/...')\"}"
                        }];
                    case 15: throw new Error("Unknown tool: ".concat(toolName));
                    case 16: return [3 /*break*/, 18];
                    case 17:
                        error_2 = _b.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                        logger_1.logger.error("Tool execution failed: ".concat(toolName), error_2);
                        return [2 /*return*/, { error: errorMessage, success: false }];
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute bash command with full credential access
     */
    ToolBasedAgent.prototype.executeBash = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var execEnv, _a, stdout, stderr, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        logger_1.logger.info("Running: ".concat(command));
                        execEnv = __assign(__assign({}, process.env), { PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME || require('os').homedir() });
                        // GitHub credentials
                        if (process.env.GITHUB_TOKEN) {
                            execEnv.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
                            execEnv.GH_TOKEN = process.env.GITHUB_TOKEN;
                        }
                        else if (process.env.GH_TOKEN) {
                            execEnv.GH_TOKEN = process.env.GH_TOKEN;
                            execEnv.GITHUB_TOKEN = process.env.GH_TOKEN;
                        }
                        // Google Cloud credentials
                        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                            execEnv.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
                        }
                        if (process.env.CLOUDSDK_CONFIG) {
                            execEnv.CLOUDSDK_CONFIG = process.env.CLOUDSDK_CONFIG;
                        }
                        else {
                            execEnv.CLOUDSDK_CONFIG = "".concat(require('os').homedir(), "/.config/gcloud");
                        }
                        if (process.env.GCP_PROJECT_ID) {
                            execEnv.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
                            execEnv.GOOGLE_CLOUD_PROJECT = process.env.GCP_PROJECT_ID;
                        }
                        // Trello credentials (for CLI tools if needed)
                        if (process.env.TRELLO_API_KEY) {
                            execEnv.TRELLO_API_KEY = process.env.TRELLO_API_KEY;
                        }
                        if (process.env.TRELLO_API_TOKEN) {
                            execEnv.TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;
                        }
                        logger_1.logger.info("Environment prepared with credentials for: ".concat(Object.keys(execEnv).filter(function (k) { return k.includes('TOKEN') || k.includes('KEY') || k.includes('CREDENTIALS'); }).join(', ')));
                        return [4 /*yield*/, execAsync(command, {
                                cwd: process.cwd(),
                                timeout: 30000, // 30 second timeout
                                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                                env: execEnv
                            })];
                    case 1:
                        _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                        return [2 /*return*/, {
                                success: true,
                                stdout: stdout || '(no output)',
                                stderr: stderr || '',
                                exitCode: 0
                            }];
                    case 2:
                        error_3 = _b.sent();
                        return [2 /*return*/, {
                                success: false,
                                stdout: error_3.stdout || '',
                                stderr: error_3.stderr || error_3.message,
                                exitCode: error_3.code || 1
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Trello: List boards
     */
    ToolBasedAgent.prototype.trelloListBoards = function () {
        return __awaiter(this, void 0, void 0, function () {
            var boards;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.trelloService) {
                            return [2 /*return*/, { error: 'Trello service not available', success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.getBoards()];
                    case 1:
                        boards = _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                boards: boards.map(function (b) { return ({ id: b.id, name: b.name }); })
                            }];
                }
            });
        });
    };
    /**
     * Trello: Get board by name
     */
    ToolBasedAgent.prototype.trelloGetBoard = function (boardName) {
        return __awaiter(this, void 0, void 0, function () {
            var board;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.trelloService) {
                            return [2 /*return*/, { error: 'Trello service not available', success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.findBoardByName(boardName)];
                    case 1:
                        board = _a.sent();
                        if (!board) {
                            return [2 /*return*/, { error: "Board not found: ".concat(boardName), success: false }];
                        }
                        return [2 /*return*/, { success: true, board: { id: board.id, name: board.name } }];
                }
            });
        });
    };
    /**
     * Trello: Create list
     */
    ToolBasedAgent.prototype.trelloCreateList = function (boardName, listName) {
        return __awaiter(this, void 0, void 0, function () {
            var board, list;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.trelloService) {
                            return [2 /*return*/, { error: 'Trello service not available', success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.findBoardByName(boardName)];
                    case 1:
                        board = _a.sent();
                        if (!board) {
                            return [2 /*return*/, { error: "Board not found: ".concat(boardName), success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.createList(listName, board.id)];
                    case 2:
                        list = _a.sent();
                        return [2 /*return*/, { success: true, list: { id: list.id, name: list.name } }];
                }
            });
        });
    };
    /**
     * Trello: Create card
     */
    ToolBasedAgent.prototype.trelloCreateCard = function (boardName, listName, cardName, description) {
        return __awaiter(this, void 0, void 0, function () {
            var board, lists, list, card;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.trelloService) {
                            return [2 /*return*/, { error: 'Trello service not available', success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.findBoardByName(boardName)];
                    case 1:
                        board = _a.sent();
                        if (!board) {
                            return [2 /*return*/, { error: "Board not found: ".concat(boardName), success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.getLists(board.id)];
                    case 2:
                        lists = _a.sent();
                        list = lists.find(function (l) { return l.name.toLowerCase() === listName.toLowerCase(); });
                        if (!list) {
                            return [2 /*return*/, { error: "List not found: ".concat(listName, " on board ").concat(boardName), success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.createCard({
                                idList: list.id,
                                name: cardName,
                                desc: description || ''
                            })];
                    case 3:
                        card = _a.sent();
                        return [2 /*return*/, { success: true, card: { id: card.id, name: card.name, url: card.url } }];
                }
            });
        });
    };
    /**
     * Trello: List cards
     */
    ToolBasedAgent.prototype.trelloListCards = function (boardName) {
        return __awaiter(this, void 0, void 0, function () {
            var board, cards;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.trelloService) {
                            return [2 /*return*/, { error: 'Trello service not available', success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.findBoardByName(boardName)];
                    case 1:
                        board = _a.sent();
                        if (!board) {
                            return [2 /*return*/, { error: "Board not found: ".concat(boardName), success: false }];
                        }
                        return [4 /*yield*/, this.trelloService.getCardsOnBoard(board.id)];
                    case 2:
                        cards = _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                cards: cards.map(function (c) { return ({ id: c.id, name: c.name, listId: c.idList }); })
                            }];
                }
            });
        });
    };
    /**
     * Execute task with iterative tool calling
     */
    /**
     * Enhanced executeTask with automatic task decomposition
     */
    ToolBasedAgent.prototype.executeTask = function (task) {
        return __awaiter(this, void 0, void 0, function () {
            var taskType, quickEstimate, analysis, iterationLimit;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        taskType = (_a = task.context) === null || _a === void 0 ? void 0 : _a.taskType;
                        quickEstimate = smartIterationCalculator_1.SmartIterationCalculator.calculate(task.command, taskType);
                        logger_1.logger.info("\u26A1 Quick Analysis: ".concat(smartIterationCalculator_1.SmartIterationCalculator.getSummary(quickEstimate)));
                        logger_1.logger.info("   Confidence: ".concat(quickEstimate.confidence, ", Recommended: ").concat(quickEstimate.recommended, " iterations"));
                        if (!(quickEstimate.recommended <= 8 && quickEstimate.confidence === 'high')) return [3 /*break*/, 3];
                        logger_1.logger.info("\u26A1 Fast path: Using ".concat(quickEstimate.recommended, " iterations (skipping deep analysis)"));
                        return [4 /*yield*/, this.notify("\u26A1 **Quick Task** (".concat(quickEstimate.recommended, " iterations)\n").concat(quickEstimate.reasoning))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, this.executeSimpleTask(task, quickEstimate.recommended)];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3:
                        if (!(quickEstimate.recommended <= 6 && quickEstimate.confidence === 'medium')) return [3 /*break*/, 6];
                        logger_1.logger.info("\u26A1 Fast path: Using ".concat(quickEstimate.recommended, " iterations (medium confidence, skipping deep analysis)"));
                        return [4 /*yield*/, this.notify("\u26A1 **Quick Task** (".concat(quickEstimate.recommended, " iterations)\n").concat(quickEstimate.reasoning))];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, this.executeSimpleTask(task, quickEstimate.recommended)];
                    case 5: return [2 /*return*/, _b.sent()];
                    case 6:
                        // Step 3: For complex tasks or uncertain cases, do deep AI analysis
                        logger_1.logger.info("\uD83D\uDD0D Task needs deep analysis - running AI-powered complexity assessment...");
                        return [4 /*yield*/, this.notify("\uD83D\uDD0D **Analyzing Task Complexity**\nDetermining optimal execution strategy...")];
                    case 7:
                        _b.sent();
                        return [4 /*yield*/, this.taskDecomposer.analyzeTask(task.command)];
                    case 8:
                        analysis = _b.sent();
                        logger_1.logger.info("\uD83D\uDCCA Deep Analysis Result: ".concat(analysis.complexity, " complexity"));
                        logger_1.logger.info("\uD83D\uDCCA Estimated iterations: ".concat(analysis.estimatedIterations));
                        logger_1.logger.info("\uD83D\uDCCA Requires decomposition: ".concat(analysis.requiresDecomposition));
                        // Notify user of the detailed plan
                        return [4 /*yield*/, this.notify("\uD83D\uDCCA **Task Analysis Complete**\n\n" +
                                "**Complexity:** ".concat(analysis.complexity, "\n") +
                                "**Estimated Iterations:** ".concat(analysis.estimatedIterations, "\n") +
                                "**Strategy:** ".concat(analysis.requiresDecomposition ? "Breaking into ".concat(analysis.subtasks.length, " subtasks") : 'Direct execution', "\n\n") +
                                "**Reasoning:** ".concat(analysis.reasoning))];
                    case 9:
                        // Notify user of the detailed plan
                        _b.sent();
                        if (!(analysis.requiresDecomposition && analysis.subtasks.length > 0)) return [3 /*break*/, 11];
                        logger_1.logger.info("\uD83D\uDD27 Decomposing task into ".concat(analysis.subtasks.length, " subtasks"));
                        return [4 /*yield*/, this.executeDecomposedTask(task, analysis)];
                    case 10: return [2 /*return*/, _b.sent()];
                    case 11:
                        iterationLimit = this.taskDecomposer.calculateIterationLimit(analysis);
                        if (analysis.complexity === 'simple' || analysis.complexity === 'moderate') {
                            iterationLimit = Math.min(iterationLimit, 10); // Cap simple/moderate at 10
                        }
                        logger_1.logger.info("\u26A1 Executing task directly with ".concat(iterationLimit, " iteration limit"));
                        return [4 /*yield*/, this.executeSimpleTask(task, iterationLimit)];
                    case 12: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Execute decomposed task as multiple subtasks
     */
    ToolBasedAgent.prototype.executeDecomposedTask = function (task, analysis) {
        return __awaiter(this, void 0, void 0, function () {
            var executionBatches, totalIterations, totalToolCalls, results, batchIndex, batch, batchType, batchResults, _i, batch_1, subtask, result, success, summary;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.notify("\uD83D\uDE80 **Starting Decomposed Execution**\n".concat(analysis.subtasks.length, " subtasks identified"))];
                    case 1:
                        _b.sent();
                        executionBatches = this.taskDecomposer.getExecutionOrder(analysis.subtasks);
                        totalIterations = 0;
                        totalToolCalls = 0;
                        results = [];
                        logger_1.logger.info("\uD83D\uDCCB Execution plan: ".concat(executionBatches.length, " batches"));
                        batchIndex = 0;
                        _b.label = 2;
                    case 2:
                        if (!(batchIndex < executionBatches.length)) return [3 /*break*/, 11];
                        batch = executionBatches[batchIndex];
                        batchType = ((_a = batch[0]) === null || _a === void 0 ? void 0 : _a.type) || 'sequential';
                        return [4 /*yield*/, this.notify("\uD83D\uDCE6 **Batch ".concat(batchIndex + 1, "/").concat(executionBatches.length, "**\n") +
                                "".concat(batch.length, " task(s) - ").concat(batchType, " execution"))];
                    case 3:
                        _b.sent();
                        if (!(batchType === 'parallel' && batch.length > 1)) return [3 /*break*/, 5];
                        // Execute in parallel
                        logger_1.logger.info("\u26A1 Executing ".concat(batch.length, " tasks in parallel"));
                        return [4 /*yield*/, Promise.all(batch.map(function (subtask) { return _this.executeSubtask(task, subtask); }))];
                    case 4:
                        batchResults = _b.sent();
                        batchResults.forEach(function (result) {
                            totalIterations += result.iterations;
                            totalToolCalls += result.toolCalls;
                            if (result.message)
                                results.push(result.message);
                        });
                        return [3 /*break*/, 10];
                    case 5:
                        // Execute sequentially
                        logger_1.logger.info("\uD83D\uDD04 Executing ".concat(batch.length, " tasks sequentially"));
                        _i = 0, batch_1 = batch;
                        _b.label = 6;
                    case 6:
                        if (!(_i < batch_1.length)) return [3 /*break*/, 10];
                        subtask = batch_1[_i];
                        return [4 /*yield*/, this.executeSubtask(task, subtask)];
                    case 7:
                        result = _b.sent();
                        totalIterations += result.iterations;
                        totalToolCalls += result.toolCalls;
                        if (result.message)
                            results.push(result.message);
                        if (!!result.success) return [3 /*break*/, 9];
                        logger_1.logger.warn("\u26A0\uFE0F Subtask failed: ".concat(subtask.description));
                        return [4 /*yield*/, this.notify("\u26A0\uFE0F **Subtask Failed**\n".concat(subtask.description, "\n\nContinuing with remaining tasks..."))];
                    case 8:
                        _b.sent();
                        _b.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 6];
                    case 10:
                        batchIndex++;
                        return [3 /*break*/, 2];
                    case 11:
                        success = results.length > 0;
                        summary = results.join('\n\n');
                        return [2 /*return*/, {
                                success: success,
                                message: summary || 'All subtasks completed',
                                iterations: totalIterations,
                                toolCalls: totalToolCalls
                            }];
                }
            });
        });
    };
    /**
     * Execute a single subtask
     */
    ToolBasedAgent.prototype.executeSubtask = function (parentTask, subtask) {
        return __awaiter(this, void 0, void 0, function () {
            var subtaskCommand, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.info("\uD83D\uDCDD Executing subtask: ".concat(subtask.description));
                        return [4 /*yield*/, this.notify("\uD83D\uDCDD **Subtask ".concat(subtask.id, "**\n").concat(subtask.description, "\n_(Est. ").concat(subtask.estimatedIterations, " iterations)_"))];
                    case 1:
                        _a.sent();
                        subtaskCommand = __assign(__assign({}, parentTask), { command: subtask.description });
                        return [4 /*yield*/, this.executeSimpleTask(subtaskCommand, subtask.estimatedIterations + 5)];
                    case 2:
                        result = _a.sent();
                        if (!result.success) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.notify("\u2705 **Subtask Complete:** ".concat(subtask.id, "\n").concat(result.iterations, " iterations, ").concat(result.toolCalls, " tool calls"))];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Execute a simple task without decomposition
     */
    ToolBasedAgent.prototype.executeSimpleTask = function (task, iterationLimit) {
        return __awaiter(this, void 0, void 0, function () {
            var maxIter, conversationHistory, iterations, toolCalls, continueLoop, response, toolUses, toolResults, _i, toolUses_1, toolUse, result, resultPreview, textBlocks, finalMessage, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        maxIter = iterationLimit || this.maxIterations;
                        conversationHistory = [];
                        iterations = 0;
                        toolCalls = 0;
                        continueLoop = true;
                        // Initial user message
                        conversationHistory.push({
                            role: 'user',
                            content: this.buildInitialPrompt(task)
                        });
                        return [4 /*yield*/, this.notify("\uD83E\uDD16 **Agent Started**\n```\n".concat(task.command, "\n```"))];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 19, , 21]);
                        _a.label = 3;
                    case 3:
                        if (!(continueLoop && iterations < maxIter)) return [3 /*break*/, 16];
                        iterations++;
                        logger_1.logger.info("\uD83D\uDD04 Iteration ".concat(iterations, "/").concat(maxIter));
                        return [4 /*yield*/, this.notify("\uD83D\uDD04 **Iteration ".concat(iterations, "/").concat(maxIter, "**\nProcessing..."))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.client.messages.create({
                                model: 'claude-sonnet-4-5',
                                max_tokens: 4096,
                                tools: this.getTools(),
                                messages: conversationHistory
                            })];
                    case 5:
                        response = _a.sent();
                        // Add assistant response to history
                        conversationHistory.push({
                            role: 'assistant',
                            content: response.content
                        });
                        if (!(response.stop_reason === 'tool_use')) return [3 /*break*/, 12];
                        toolUses = response.content.filter(function (block) { return block.type === 'tool_use'; });
                        logger_1.logger.info("\uD83D\uDD27 Claude requested ".concat(toolUses.length, " tool call(s)"));
                        toolResults = [];
                        _i = 0, toolUses_1 = toolUses;
                        _a.label = 6;
                    case 6:
                        if (!(_i < toolUses_1.length)) return [3 /*break*/, 11];
                        toolUse = toolUses_1[_i];
                        toolCalls++;
                        return [4 /*yield*/, this.notify("\uD83D\uDD27 **Tool Call ".concat(toolCalls, "**\n**Tool:** `").concat(toolUse.name, "`\n**Input:** ```json\n").concat(JSON.stringify(toolUse.input, null, 2), "\n```"))];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, this.executeTool(toolUse.name, toolUse.input)];
                    case 8:
                        result = _a.sent();
                        toolResults.push({
                            type: 'tool_result',
                            tool_use_id: toolUse.id,
                            content: JSON.stringify(result)
                        });
                        resultPreview = JSON.stringify(result).substring(0, 300);
                        return [4 /*yield*/, this.notify("\u2705 **Tool Result**\n```json\n".concat(resultPreview).concat(JSON.stringify(result).length > 300 ? '...' : '', "\n```"))];
                    case 9:
                        _a.sent();
                        _a.label = 10;
                    case 10:
                        _i++;
                        return [3 /*break*/, 6];
                    case 11:
                        // Send tool results back to Claude
                        conversationHistory.push({
                            role: 'user',
                            content: toolResults
                        });
                        return [3 /*break*/, 15];
                    case 12:
                        if (!(response.stop_reason === 'end_turn')) return [3 /*break*/, 14];
                        // Claude is done
                        continueLoop = false;
                        logger_1.logger.info('✅ Task complete - Claude ended turn');
                        textBlocks = response.content.filter(function (block) { return block.type === 'text'; });
                        finalMessage = textBlocks.map(function (b) { return b.text; }).join('\n');
                        return [4 /*yield*/, this.notify("\uD83C\uDFC1 **Task Complete**\n".concat(finalMessage))];
                    case 13:
                        _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: finalMessage,
                                iterations: iterations,
                                toolCalls: toolCalls
                            }];
                    case 14:
                        if (response.stop_reason === 'max_tokens') {
                            logger_1.logger.warn('⚠️ Hit max tokens limit');
                            continueLoop = false;
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Task incomplete - hit token limit',
                                    iterations: iterations,
                                    toolCalls: toolCalls,
                                    error: 'max_tokens'
                                }];
                        }
                        _a.label = 15;
                    case 15: return [3 /*break*/, 3];
                    case 16:
                        if (!(iterations >= maxIter)) return [3 /*break*/, 18];
                        logger_1.logger.warn("\u26A0\uFE0F Hit max iterations (".concat(maxIter, ")"));
                        return [4 /*yield*/, this.notify("\u26A0\uFE0F **Max Iterations Reached**\nCompleted ".concat(iterations, " iterations with ").concat(toolCalls, " tool calls."))];
                    case 17:
                        _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: "Task incomplete - reached max iterations (".concat(maxIter, ")"),
                                iterations: iterations,
                                toolCalls: toolCalls,
                                error: 'max_iterations'
                            }];
                    case 18: 
                    // Shouldn't reach here
                    return [2 /*return*/, {
                            success: false,
                            message: 'Task ended unexpectedly',
                            iterations: iterations,
                            toolCalls: toolCalls,
                            error: 'unexpected_end'
                        }];
                    case 19:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : 'Unknown error';
                        logger_1.logger.error('❌ Agent execution failed', error_4);
                        return [4 /*yield*/, this.notify("\u274C **Agent Failed**\n```\n".concat(errorMessage, "\n```"))];
                    case 20:
                        _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: errorMessage,
                                iterations: iterations,
                                toolCalls: toolCalls,
                                error: errorMessage
                            }];
                    case 21: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Build initial system prompt
     */
    ToolBasedAgent.prototype.buildInitialPrompt = function (task) {
        var prompt = "You are an autonomous AI agent with FULL ACCESS to the user's authenticated tools and APIs.";
        // Add conversation history for context continuity
        if (task.context.conversationHistory) {
            prompt += "\n\n\uD83D\uDCDC RECENT CONVERSATION HISTORY:\n".concat(task.context.conversationHistory, "\n\n---");
        }
        prompt += "\n\nTASK: ".concat(task.command, "\n\n\uD83D\uDD27 AVAILABLE TOOLS:\n\n1. **execute_bash**: Run ANY bash command\n   - Git operations (clone, commit, push, pull, etc.)\n   - File operations (read, write, move, delete, etc.)\n   - Package managers (npm, pip, etc.)\n   - Process management\n   - System commands\n\n2. **GitHub CLI (gh)**: Fully authenticated\n   - gh repo list, gh repo view, gh repo clone\n   - gh issue list, gh issue create\n   - gh pr list, gh pr create\n   - gh api (REST API access)\n   - User is ALREADY logged in via: gh auth login\n\n3. **Google Cloud CLI (gcloud)**: Fully authenticated  \n   - gcloud projects list\n   - gcloud compute instances list\n   - gcloud run services list\n   - gcloud builds submit\n   - User is ALREADY logged in via: gcloud auth login");
        if (this.trelloService) {
            prompt += "\n\n4. **Trello REST API**: Fully authenticated\n   - trello_list_boards: List all Trello boards\n   - trello_get_board: Get a specific board by name\n   - trello_create_list: Create a list on a board\n   - trello_create_card: Create a card on a list\n   - trello_list_cards: List all cards on a board";
        }
        prompt += "\n\n\uD83D\uDD11 AUTHENTICATION STATUS:\n\u2705 GitHub: FULLY AUTHENTICATED - gh CLI + GITHUB_TOKEN environment variable\n   - You can run ANY gh command (gh repo list, gh issue create, gh pr create, etc.)\n   - The user has already logged in with: gh auth login\n   - Token is available in environment as GITHUB_TOKEN\n   \n\u2705 Google Cloud: FULLY AUTHENTICATED - gcloud CLI + credentials\n   - You can run ANY gcloud command\n   - The user has already logged in with: gcloud auth login";
        if (this.trelloService) {
            prompt += "\n\u2705 Trello: Authenticated via REST API (API keys configured)";
        }
        prompt += "\n\n\uD83D\uDCCB EXECUTION GUIDELINES:\n\n1. **Work Iteratively**: Call tools, check results, decide next steps\n2. **Handle Errors Gracefully**: If a tool fails, analyze the error and try alternative approaches\n3. **Break Down Complex Tasks**: Split large tasks into smaller, manageable steps\n4. **Use the Right Tool**: Choose between CLI commands (via execute_bash) and native tools (like trello_*)\n5. **Provide Context**: The user receives Discord notifications for EVERY tool call showing:\n   - What command/tool you're using\n   - What the results are\n   - Progress updates\n\n\uD83D\uDE80 EXAMPLES:\n\nExample 1 - GitHub:\n  Task: \"List my 5 most recent repos\"\n  Tool: execute_bash\n  Command: \"gh repo list --limit 5 --json name,url,updatedAt\"\n\nExample 2 - Trello:\n  Task: \"Create a card on my TODO list\"\n  Tool: trello_create_card\n  Params: { boardName: \"Personal\", listName: \"TODO\", cardName: \"New Task\" }\n\nExample 3 - Multi-step:\n  Task: \"Fetch my repos and create Trello cards for each\"\n  Step 1: execute_bash(\"gh repo list --limit 5 --json name\")\n  Step 2: For each repo, call trello_create_card(...)\n  Step 3: Provide summary of created cards\n\n\uD83D\uDCA1 CRITICAL - READ THIS:\n- You have FULL credentials for GitHub, GCloud, and Trello\n- The user is ALREADY authenticated to these services via CLI login\n- GITHUB_TOKEN environment variable IS SET and available\n- You can execute ANY command that the user could run in their terminal\n- Do NOT claim you don't have access - YOU DO!\n- Just run the commands - they WILL work!\n- Be confident and take action!\n\nNOW: Execute the task using the available tools.";
        return prompt;
    };
    return ToolBasedAgent;
}());
exports.ToolBasedAgent = ToolBasedAgent;
