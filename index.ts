import * as ts_module from "typescript/lib/tsserverlibrary";
import * as _ from "lodash/string";
import * as Path from "path";

interface ImportDetails {
    _isImportDetails: true;
    moduleName: string;
    relativePath: string;
}

function parseImportDetails(json: string): ImportDetails | void {
    try {
        const parsed = JSON.parse(json);
        if (parsed._isImportDetails) {
            return parsed;
        }
        return null;
    } catch(err) {
        return null;
    }
}

function stripFileSuffix(path: string) {
    const index = path.lastIndexOf(".");
    return path.slice(0, index);
}

function moduleNameForFileName(path: string) {
    const file_name = stripFileSuffix(path.split('/').pop());
    return _.upperFirst(_.camelCase(file_name));
}

function matchesText(text: string, includePrefixMatches: boolean) {
    if (includePrefixMatches) {
        return (file: ts_module.SourceFile) => {
            return moduleNameForFileName(file.fileName).indexOf(text) === 0;
        };
    } else {
        return (file: ts_module.SourceFile) => {
            return moduleNameForFileName(file.fileName) === text;
        };
    }
}

const defaultCompletionInfo: ts_module.CompletionInfo = {
    isGlobalCompletion: false,
    isMemberCompletion: false,
    isNewIdentifierLocation: false,
    entries: []
};

const defaultCompletionEntryDetails: ts_module.CompletionEntryDetails = {
    name: "",
    kind: ts_module.ScriptElementKind.unknown,
    kindModifiers: "",
    displayParts: [],
    documentation: [],
    tags: []
};

function init(modules: {typescript: typeof ts_module}) {
    const ts = modules.typescript;

    function create(info: ts.server.PluginCreateInfo) {

        info.project.projectService.logger.info("xcxc I'm getting set up now! Check the log for this message.");

        function getTextAtPosition(filename: string, position: number): string | void {
            const file = info.languageService.getProgram().getSourceFile(filename).text;
            const match = file.substr(0, position).match(/[a-zA-Z_$][0-9a-zA-Z_$]*$/);
            if (match) {
                return match[0];
            } else {
                return null;
            }
        }

        function mapSourceFileToImportDetails(currentFile: string): (file: ts_module.SourceFile) => ImportDetails {
            return (file: ts_module.SourceFile) => {
                const baseUrl = info.languageServiceHost.getCompilationSettings().baseUrl;
                const relativePath = baseUrl 
                    ? Path.relative(baseUrl, file.fileName)
                    : Path.relative(currentFile);
                return {
                    _isImportDetails: true,
                    moduleName: moduleNameForFileName(file.fileName),
                    relativePath: stripFileSuffix(relativePath)
                };
            };
        }

        function getImportDetailsAtPosition(fileName, position, includePrefixMatches): ImportDetails[] {
            const text = getTextAtPosition(fileName, position);
            info.project.projectService.logger.info(`xcxc0.1 getImportDetailsAtPosition ${text}`);
            if (text) {
                const files = proxy.getProgram().getSourceFiles();
                return files.filter(
                    matchesText(text, includePrefixMatches)
                ).map(
                    mapSourceFileToImportDetails(fileName)
                );
            } else {
                return [];
            }
        }

        function mapImportDetailsToCodeFix(fileName: string, importDetails: ImportDetails): ts_module.CodeFixAction {
            const importText = `import * as ${importDetails.moduleName} from "${importDetails.relativePath}";\n`;
            const importTextChange: ts_module.TextChange = {
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

        function mapImportDetailsToCompletionEntry(importDetails: ImportDetails): ts_module.CompletionEntry {
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
        const proxy: ts.LanguageService = Object.create(null);        
        for (let k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
            const x = info.languageService[k];
            proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
        }

        proxy.getCompletionsAtPosition = (fileName, position, options) => {
            info.project.projectService.logger.info(`xcxc0 getCompletionsAtPosition: ${fileName}, ${position}, ${options}`);
            // Implementation can return undefined here even though interface doesn't say so.
            let originalCompletionInfo = info.languageService.getCompletionsAtPosition(fileName, position, options);
            const newImports = getImportDetailsAtPosition(fileName, position, true);
            if (!originalCompletionInfo && !newImports) {
                return undefined;
            }
            if (!originalCompletionInfo) {
                originalCompletionInfo = defaultCompletionInfo;
            }
            const newEntries = newImports.map(mapImportDetailsToCompletionEntry);
            return {
                ...originalCompletionInfo,
                entries: [...originalCompletionInfo.entries, ...newEntries]
            };
        };

        proxy.getCompletionEntryDetails = (fileName, position, name, options, source) => {
            info.project.projectService.logger.info(`xcxc1 getCompletionEntryDetails ${fileName}, ${position}, ${name}, ${options}, ${source}`);

            const originalDetails = info.languageService.getCompletionEntryDetails(fileName, position, name, options, source);
            const importDetails = parseImportDetails(source);
            if (importDetails) {
                info.project.projectService.logger.info(`xcxc Adding code fix to completion entry`);

                const codeFix = mapImportDetailsToCodeFix(fileName, importDetails);
                return {
                    ...defaultCompletionEntryDetails,
                    ...originalDetails,
                    codeActions: [codeFix]
                };
            } else {
                return originalDetails;
            }
        };

        proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions) => {
            info.project.projectService.logger.info(`xcxc2 getCodeFixesAtPosition ${fileName}, ${start}, ${end}, ${errorCodes}, ${formatOptions}`);

            const originalCodeFixes = info.languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions);
            const newImports = getImportDetailsAtPosition(fileName, end, false);
            const newCodeFixes = newImports.map(importDetails => mapImportDetailsToCodeFix(fileName, importDetails));
            return [...originalCodeFixes, ...newCodeFixes];
        };

        return proxy;
    }

    return { create };
    
}

export = init;