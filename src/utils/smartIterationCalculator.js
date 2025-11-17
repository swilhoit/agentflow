"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartIterationCalculator = void 0;
var SmartIterationCalculator = /** @class */ (function () {
    function SmartIterationCalculator() {
    }
    /**
     * Calculate optimal iterations based on task description and type
     */
    SmartIterationCalculator.calculate = function (taskDescription, taskType) {
        var lowerDesc = taskDescription.toLowerCase();
        // 1. Check for explicit simple operations (3-5 iterations)
        if (this.isSimpleTask(lowerDesc)) {
            return {
                recommended: 5,
                min: 3,
                max: 8,
                reasoning: 'Simple single-operation task',
                confidence: 'high'
            };
        }
        // 2. Check for list/display operations (3-5 iterations - VERY FAST!)
        if (this.isListingTask(lowerDesc)) {
            return {
                recommended: 4,
                min: 3,
                max: 6,
                reasoning: 'List/display operation',
                confidence: 'high'
            };
        }
        // 3. Check for create/update operations (8-12 iterations)
        if (this.isCreateUpdateTask(lowerDesc)) {
            var count = this.estimateItemCount(lowerDesc);
            return {
                recommended: Math.min(8 + (count * 2), 15),
                min: 6,
                max: 15,
                reasoning: "Create/update operation (".concat(count, " item(s))"),
                confidence: 'high'
            };
        }
        // 4. Check for analysis tasks (10-15 iterations)
        if (this.isAnalysisTask(lowerDesc)) {
            return {
                recommended: 12,
                min: 8,
                max: 18,
                reasoning: 'Analysis/review task',
                confidence: 'medium'
            };
        }
        // 5. Check for complex multi-step tasks (15-25 iterations)
        if (this.isComplexTask(lowerDesc)) {
            var count = this.estimateItemCount(lowerDesc);
            return {
                recommended: Math.min(15 + (count * 3), 30),
                min: 12,
                max: 30,
                reasoning: "Complex multi-step task (".concat(count, " item(s))"),
                confidence: 'medium'
            };
        }
        // 6. Check task type overrides
        if (taskType) {
            var typeEstimate = this.estimateByType(taskType);
            if (typeEstimate)
                return typeEstimate;
        }
        // 7. Default for moderate tasks (REDUCED!)
        return {
            recommended: 8,
            min: 5,
            max: 12,
            reasoning: 'Moderate complexity task (default)',
            confidence: 'low'
        };
    };
    /**
     * Simple tasks: single operations, no loops
     */
    SmartIterationCalculator.isSimpleTask = function (desc) {
        var simplePatterns = [
            /^(get|show|display|list|find) (the |my )?[a-z]+$/i,
            /^check [a-z]+ status$/i,
            /^delete (this|that|the)? [a-z]+$/i,
            /^stop [a-z]+$/i,
            /^start [a-z]+$/i
        ];
        // Single word commands
        if (desc.split(' ').length <= 3) {
            return true;
        }
        return simplePatterns.some(function (pattern) { return pattern.test(desc); });
    };
    /**
     * Listing tasks: fetch and display data
     */
    SmartIterationCalculator.isListingTask = function (desc) {
        var listingKeywords = [
            'list', 'show', 'display', 'get', 'fetch',
            'view', 'see', 'find', 'search', 'retrieve',
            'pull', 'tell me about', 'information about',
            'details about', 'what', 'look at'
        ];
        var hasListingKeyword = listingKeywords.some(function (kw) { return desc.includes(kw); });
        var hasMultipleSteps = desc.includes('and') || desc.includes('then');
        return hasListingKeyword && !hasMultipleSteps;
    };
    /**
     * Create/update tasks
     */
    SmartIterationCalculator.isCreateUpdateTask = function (desc) {
        var keywords = [
            'create', 'make', 'add', 'new',
            'update', 'modify', 'change', 'edit',
            'rename', 'move'
        ];
        return keywords.some(function (kw) { return desc.includes(kw); });
    };
    /**
     * Analysis tasks
     */
    SmartIterationCalculator.isAnalysisTask = function (desc) {
        var keywords = [
            'analyze', 'review', 'examine', 'inspect',
            'summarize', 'compare', 'evaluate', 'assess'
        ];
        return keywords.some(function (kw) { return desc.includes(kw); });
    };
    /**
     * Complex tasks: multiple steps, loops, or "for each"
     */
    SmartIterationCalculator.isComplexTask = function (desc) {
        var complexIndicators = [
            'for each', 'go through', 'iterate',
            'all the', 'every', 'each of',
            'then', 'after that', 'next',
            'and also', 'in addition'
        ];
        var multipleSteps = (desc.match(/and|then/g) || []).length >= 2;
        var hasComplexIndicator = complexIndicators.some(function (ind) { return desc.includes(ind); });
        return multipleSteps || hasComplexIndicator;
    };
    /**
     * Estimate number of items involved
     */
    SmartIterationCalculator.estimateItemCount = function (desc) {
        // Look for explicit numbers
        var numberMatch = desc.match(/\b(\d+)\b/);
        if (numberMatch) {
            return Math.min(parseInt(numberMatch[1]), 20); // Cap at 20
        }
        // Look for quantifiers
        if (desc.includes('all ') || desc.includes('every '))
            return 10;
        if (desc.includes('few ') || desc.includes('couple '))
            return 3;
        if (desc.includes('several '))
            return 5;
        if (desc.includes('many '))
            return 8;
        return 1;
    };
    /**
     * Estimate by task type
     */
    SmartIterationCalculator.estimateByType = function (taskType) {
        var typeMap = {
            'terminal': {
                recommended: 5,
                min: 3,
                max: 8,
                reasoning: 'Simple terminal command',
                confidence: 'high'
            },
            'trello': {
                recommended: 5,
                min: 3,
                max: 8,
                reasoning: 'Trello API operation',
                confidence: 'high'
            },
            'api_call': {
                recommended: 8,
                min: 5,
                max: 12,
                reasoning: 'Single API call',
                confidence: 'high'
            },
            'analysis': {
                recommended: 12,
                min: 8,
                max: 18,
                reasoning: 'Analysis task',
                confidence: 'medium'
            },
            'coding': {
                recommended: 20,
                min: 15,
                max: 30,
                reasoning: 'Multi-step coding task',
                confidence: 'medium'
            },
            'deployment': {
                recommended: 15,
                min: 10,
                max: 25,
                reasoning: 'Deployment process',
                confidence: 'medium'
            }
        };
        return typeMap[taskType] || null;
    };
    /**
     * Get human-readable summary
     */
    SmartIterationCalculator.getSummary = function (estimate) {
        return "Recommended: ".concat(estimate.recommended, " iterations (").concat(estimate.reasoning, ")");
    };
    return SmartIterationCalculator;
}());
exports.SmartIterationCalculator = SmartIterationCalculator;
