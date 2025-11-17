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
exports.TaskDecomposer = void 0;
var logger_1 = require("./logger");
var sdk_1 = require("@anthropic-ai/sdk");
/**
 * TaskDecomposer - Automatically analyzes and breaks down complex tasks
 *
 * This helps agents handle tasks that would exceed iteration limits by:
 * 1. Detecting task complexity
 * 2. Breaking into manageable subtasks
 * 3. Estimating resource requirements
 * 4. Creating execution plan with dependencies
 */
var TaskDecomposer = /** @class */ (function () {
    function TaskDecomposer(apiKey) {
        this.anthropicClient = new sdk_1.default({ apiKey: apiKey });
    }
    /**
     * Analyze a task and determine if it needs decomposition
     */
    TaskDecomposer.prototype.analyzeTask = function (taskDescription) {
        return __awaiter(this, void 0, void 0, function () {
            var quickAnalysis, response, analysisText, jsonMatch, analysis, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.info("\uD83D\uDD0D Analyzing task complexity: ".concat(taskDescription.substring(0, 100), "..."));
                        quickAnalysis = this.quickComplexityCheck(taskDescription);
                        if (quickAnalysis.complexity === 'simple') {
                            logger_1.logger.info('✅ Task is simple, no decomposition needed');
                            return [2 /*return*/, quickAnalysis];
                        }
                        // For moderate to complex tasks, use Claude for detailed analysis
                        logger_1.logger.info('🤖 Using Claude for detailed task analysis...');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.anthropicClient.messages.create({
                                model: 'claude-sonnet-4-5',
                                max_tokens: 2048,
                                system: "You are a task analysis expert. Analyze tasks and break them down into optimal subtasks.\n        \nYour job:\n1. Assess task complexity (simple/moderate/complex/very_complex)\n2. Estimate iterations needed (1 iteration \u2248 1-3 operations)\n3. Break complex tasks into subtasks\n4. Identify dependencies between subtasks\n5. Prioritize subtasks\n\nCOMPLEXITY LEVELS:\n- simple: 1-5 iterations, single operation (e.g., \"list my repos\")\n- moderate: 6-15 iterations, few steps (e.g., \"create 3 Trello cards\")\n- complex: 16-40 iterations, many steps (e.g., \"analyze 5 repos and create cards\")\n- very_complex: 40+ iterations, requires decomposition (e.g., \"process all repos, create full project plan\")\n\nDECOMPOSITION RULES:\n- Each subtask should be independently executable\n- Each subtask should take \u226415 iterations\n- Minimize dependencies for parallel execution\n- Group related operations together\n\nRespond in JSON format only:\n{\n  \"complexity\": \"simple|moderate|complex|very_complex\",\n  \"estimatedIterations\": <number>,\n  \"requiresDecomposition\": <boolean>,\n  \"reasoning\": \"<brief explanation>\",\n  \"subtasks\": [\n    {\n      \"id\": \"subtask_1\",\n      \"description\": \"<clear description>\",\n      \"estimatedIterations\": <number>,\n      \"dependencies\": [\"<other_subtask_ids>\"],\n      \"priority\": <1-10>,\n      \"type\": \"sequential|parallel\"\n    }\n  ]\n}",
                                messages: [
                                    {
                                        role: 'user',
                                        content: "Analyze this task and determine if it needs decomposition:\n\nTASK: ".concat(taskDescription, "\n\nProvide your analysis in JSON format.")
                                    }
                                ]
                            })];
                    case 2:
                        response = _a.sent();
                        analysisText = response.content[0].type === 'text'
                            ? response.content[0].text
                            : '';
                        jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                        if (!jsonMatch) {
                            logger_1.logger.warn('Failed to parse Claude analysis, falling back to heuristic');
                            return [2 /*return*/, quickAnalysis];
                        }
                        analysis = JSON.parse(jsonMatch[0]);
                        logger_1.logger.info("\uD83D\uDCCA Analysis complete: ".concat(analysis.complexity, " (").concat(analysis.estimatedIterations, " iterations, ").concat(analysis.subtasks.length, " subtasks)"));
                        logger_1.logger.info("\uD83D\uDCA1 Reasoning: ".concat(analysis.reasoning));
                        return [2 /*return*/, analysis];
                    case 3:
                        error_1 = _a.sent();
                        logger_1.logger.error('Failed to analyze task with Claude, using heuristic', error_1);
                        return [2 /*return*/, quickAnalysis];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Quick heuristic-based complexity check (no API call)
     */
    TaskDecomposer.prototype.quickComplexityCheck = function (taskDescription) {
        var desc = taskDescription.toLowerCase();
        var estimatedIterations = 5;
        var complexity = 'simple';
        var requiresDecomposition = false;
        var subtasks = [];
        // Count complexity indicators
        var complexityFactors = {
            // Iteration multipliers
            multiple: (desc.match(/\d+/) ? parseInt(desc.match(/\d+/)[0]) : 1),
            actions: (desc.match(/and|then|create|analyze|fetch|update|delete/g) || []).length,
            repositories: desc.includes('repo') || desc.includes('github') ? 1 : 0,
            iteration: desc.includes('each') || desc.includes('all') || desc.includes('every') ? 2 : 1,
            api: (desc.match(/trello|github|gcloud|api/g) || []).length,
            complexity: desc.includes('analyze') ? 3 : 1
        };
        // Calculate estimated iterations
        estimatedIterations = Math.max(5, complexityFactors.multiple *
            complexityFactors.actions *
            complexityFactors.iteration *
            complexityFactors.complexity +
            complexityFactors.api * 2);
        // Determine complexity level
        if (estimatedIterations <= 5) {
            complexity = 'simple';
        }
        else if (estimatedIterations <= 15) {
            complexity = 'moderate';
        }
        else if (estimatedIterations <= 40) {
            complexity = 'complex';
            requiresDecomposition = true;
        }
        else {
            complexity = 'very_complex';
            requiresDecomposition = true;
        }
        // Auto-decompose if needed
        if (requiresDecomposition) {
            subtasks.push.apply(subtasks, this.autoDecompose(taskDescription, estimatedIterations));
        }
        return {
            complexity: complexity,
            estimatedIterations: estimatedIterations,
            requiresDecomposition: requiresDecomposition,
            subtasks: subtasks,
            reasoning: "Heuristic analysis: ".concat(complexityFactors.multiple, " items \u00D7 ").concat(complexityFactors.actions, " actions \u00D7 ").concat(complexityFactors.iteration, " iteration factor \u2248 ").concat(estimatedIterations, " iterations")
        };
    };
    /**
     * Automatic task decomposition using pattern matching
     */
    TaskDecomposer.prototype.autoDecompose = function (taskDescription, totalIterations) {
        var desc = taskDescription.toLowerCase();
        var subtasks = [];
        // Pattern: "Go through X and do Y and Z"
        if (desc.includes('go through') || desc.includes('for each')) {
            var match = desc.match(/(\d+)/);
            var count = match ? parseInt(match[0]) : 5;
            // Subtask 1: Fetch items
            subtasks.push({
                id: 'fetch_items',
                description: "Fetch the ".concat(count, " items from the source"),
                estimatedIterations: 3,
                dependencies: [],
                priority: 10,
                type: 'sequential'
            });
            // Subtask 2: Process each item
            for (var i = 1; i <= Math.min(count, 10); i++) {
                subtasks.push({
                    id: "process_item_".concat(i),
                    description: "Process item ".concat(i, "/").concat(count),
                    estimatedIterations: Math.ceil(totalIterations / count),
                    dependencies: ['fetch_items'],
                    priority: 5,
                    type: 'parallel'
                });
            }
            return subtasks;
        }
        // Pattern: Multiple independent operations
        if (desc.includes('and')) {
            var parts_1 = desc.split('and').map(function (p) { return p.trim(); });
            parts_1.forEach(function (part, i) {
                subtasks.push({
                    id: "task_".concat(i + 1),
                    description: part,
                    estimatedIterations: Math.ceil(totalIterations / parts_1.length),
                    dependencies: i > 0 ? ["task_".concat(i)] : [],
                    priority: 10 - i,
                    type: 'sequential'
                });
            });
            return subtasks;
        }
        // Default: Split into equal chunks
        var numChunks = Math.ceil(totalIterations / 15);
        for (var i = 0; i < numChunks; i++) {
            subtasks.push({
                id: "chunk_".concat(i + 1),
                description: "".concat(taskDescription, " (Part ").concat(i + 1, "/").concat(numChunks, ")"),
                estimatedIterations: Math.ceil(totalIterations / numChunks),
                dependencies: i > 0 ? ["chunk_".concat(i)] : [],
                priority: 10 - i,
                type: 'sequential'
            });
        }
        return subtasks;
    };
    /**
     * Calculate optimal iteration limit for a task
     */
    TaskDecomposer.prototype.calculateIterationLimit = function (analysis) {
        var baseLimit = 15;
        switch (analysis.complexity) {
            case 'simple':
                return baseLimit;
            case 'moderate':
                return baseLimit + 5;
            case 'complex':
                return baseLimit + 10;
            case 'very_complex':
                return baseLimit + 15;
            default:
                return baseLimit;
        }
    };
    /**
     * Get execution order for subtasks based on dependencies
     */
    TaskDecomposer.prototype.getExecutionOrder = function (subtasks) {
        var batches = [];
        var completed = new Set();
        var remaining = __spreadArray([], subtasks, true);
        var _loop_1 = function () {
            var batch = remaining.filter(function (task) {
                return task.dependencies.every(function (dep) { return completed.has(dep); });
            });
            if (batch.length === 0) {
                logger_1.logger.warn('Circular dependency detected in subtasks, breaking loop');
                batches.push(remaining);
                return "break";
            }
            // Sort by priority within batch
            batch.sort(function (a, b) { return b.priority - a.priority; });
            batches.push(batch);
            // Mark as completed and remove from remaining
            batch.forEach(function (task) { return completed.add(task.id); });
            remaining.splice.apply(remaining, __spreadArray([0, remaining.length], remaining.filter(function (t) { return !batch.includes(t); }), false));
        };
        while (remaining.length > 0) {
            var state_1 = _loop_1();
            if (state_1 === "break")
                break;
        }
        return batches;
    };
    return TaskDecomposer;
}());
exports.TaskDecomposer = TaskDecomposer;
