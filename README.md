# Typescript Namespace Import Plugin

A typescript compiler plugin that makes it easier to 
automatically include namespace imports.

A [namespace import](http://exploringjs.com/es6/ch_modules.html#_importing-styles) is an import like:
```
import * as ModuleName from "path/to/module_name"
```

## Installation
git checkout this code base.

Add this plugin to your tsconfig.json file as described [here](https://github.com/Microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin#enabling-a-plugin).

You can set name to an absolute path to whatever directory contains the index.js file for typescript-namespace-import-plugin

## Features

This plugin adds the ablity to add a namespace import in 2 ways:
1. As a code fix on unknown symbols
2. As a completion suggestion

### Code Fix
Any unknown symbol that matches a file name in your project with the file name converted to CaptialCase will suggest importing that file as a namespace import
to resolve the unknown Symbol.

Note that the plugin does not look in the file at all to see if it can be imported
as a namespace.

### Completion Suggestion
When suggesting completions, the typescript service will suggest symbols that match
all files in your project with their file names converted to CapitalCase.
If you select any of these suggestions then a namespace import will be added using the code fix described above.
