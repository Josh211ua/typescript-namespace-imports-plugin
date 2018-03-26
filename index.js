"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var ts_module = require("typescript/lib/tsserverlibrary");
var _ = require("lodash/string");
var Path = require("path");
function parseImportDetails(json) {
    try {
        var parsed = JSON.parse(json);
        if (parsed._isImportDetails) {
            return parsed;
        }
        return null;
    }
    catch (err) {
        return null;
    }
}
function stripFileSuffix(path) {
    var index = path.lastIndexOf(".");
    return path.slice(0, index);
}
function moduleNameForFileName(path) {
    var file_name = stripFileSuffix(path.split('/').pop());
    return _.upperFirst(_.camelCase(file_name));
}
function matchesText(text, includePrefixMatches) {
    if (includePrefixMatches) {
        return function (file) {
            return moduleNameForFileName(file.fileName).indexOf(text) === 0;
        };
    }
    else {
        return function (file) {
            return moduleNameForFileName(file.fileName) === text;
        };
    }
}
var defaultCompletionInfo = {
    isGlobalCompletion: false,
    isMemberCompletion: false,
    isNewIdentifierLocation: false,
    entries: []
};
var defaultCompletionEntryDetails = {
    name: "",
    kind: ts_module.ScriptElementKind.unknown,
    kindModifiers: "",
    displayParts: [],
    documentation: [],
    tags: []
};
function init(modules) {
    var ts = modules.typescript;
    function create(info) {
        info.project.projectService.logger.info("xcxc I'm getting set up now! Check the log for this message.");
        function getTextAtPosition(filename, position) {
            var file = info.languageService.getProgram().getSourceFile(filename).text;
            var match = file.substr(0, position).match(/[a-zA-Z_$][0-9a-zA-Z_$]*$/);
            if (match) {
                return match[0];
            }
            else {
                return null;
            }
        }
        function mapSourceFileToImportDetails(currentFile) {
            return function (file) {
                var baseUrl = info.languageServiceHost.getCompilationSettings().baseUrl;
                var relativePath = baseUrl
                    ? Path.relative(baseUrl, file.fileName)
                    : Path.relative(currentFile);
                return {
                    _isImportDetails: true,
                    moduleName: moduleNameForFileName(file.fileName),
                    relativePath: stripFileSuffix(relativePath)
                };
            };
        }
        function getImportDetailsAtPosition(fileName, position, includePrefixMatches) {
            var text = getTextAtPosition(fileName, position);
            info.project.projectService.logger.info("xcxc0.1 getImportDetailsAtPosition " + text);
            if (text) {
                var files = proxy.getProgram().getSourceFiles();
                return files.filter(matchesText(text, includePrefixMatches)).map(mapSourceFileToImportDetails(fileName));
            }
            else {
                return [];
            }
        }
        function mapImportDetailsToCodeFix(fileName, importDetails) {
            var importText = "import * as " + importDetails.moduleName + " from \"" + importDetails.relativePath + "\";\n";
            var importTextChange = {
                // Always put imports at the very top for simplicity
                span: {
                    start: 0,
                    length: 0
                },
                newText: importText
            };
            return {
                description: importText,
                changes: [{
                        fileName: fileName,
                        textChanges: [importTextChange]
                    }],
                commands: []
            };
        }
        function mapImportDetailsToCompletionEntry(importDetails) {
            return {
                name: importDetails.moduleName,
                kind: ts_module.ScriptElementKind.externalModuleName,
                kindModifiers: ts_module.ScriptElementKindModifier.none,
                sortText: importDetails.moduleName,
                source: JSON.stringify(importDetails),
                hasAction: true
            };
        }
        // Set up decorator
        var proxy = Object.create(null);
        var _loop_1 = function (k) {
            var x = info.languageService[k];
            proxy[k] = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return x.apply(info.languageService, args);
            };
        };
        for (var _i = 0, _a = Object.keys(info.languageService); _i < _a.length; _i++) {
            var k = _a[_i];
            _loop_1(k);
        }
        proxy.getCompletionsAtPosition = function (fileName, position, options) {
            info.project.projectService.logger.info("xcxc0 getCompletionsAtPosition: " + fileName + ", " + position + ", " + options);
            // Implementation can return undefined here even though interface doesn't say so.
            var originalCompletionInfo = info.languageService.getCompletionsAtPosition(fileName, position, options);
            var newImports = getImportDetailsAtPosition(fileName, position, true);
            if (!originalCompletionInfo && !newImports) {
                return undefined;
            }
            if (!originalCompletionInfo) {
                originalCompletionInfo = defaultCompletionInfo;
            }
            var newEntries = newImports.map(mapImportDetailsToCompletionEntry);
            return __assign({}, originalCompletionInfo, { entries: originalCompletionInfo.entries.concat(newEntries) });
        };
        proxy.getCompletionEntryDetails = function (fileName, position, name, options, source) {
            info.project.projectService.logger.info("xcxc1 getCompletionEntryDetails " + fileName + ", " + position + ", " + name + ", " + options + ", " + source);
            var originalDetails = info.languageService.getCompletionEntryDetails(fileName, position, name, options, source);
            var importDetails = parseImportDetails(source);
            if (importDetails) {
                info.project.projectService.logger.info("xcxc Adding code fix to completion entry");
                var codeFix = mapImportDetailsToCodeFix(fileName, importDetails);
                return __assign({}, defaultCompletionEntryDetails, originalDetails, { codeActions: [codeFix] });
            }
            else {
                return originalDetails;
            }
        };
        proxy.getCodeFixesAtPosition = function (fileName, start, end, errorCodes, formatOptions) {
            info.project.projectService.logger.info("xcxc2 getCodeFixesAtPosition " + fileName + ", " + start + ", " + end + ", " + errorCodes + ", " + formatOptions);
            var originalCodeFixes = info.languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions);
            var newImports = getImportDetailsAtPosition(fileName, end, false);
            var newCodeFixes = newImports.map(function (importDetails) { return mapImportDetailsToCodeFix(fileName, importDetails); });
            return originalCodeFixes.concat(newCodeFixes);
        };
        return proxy;
    }
    return { create: create };
}
module.exports = init;
