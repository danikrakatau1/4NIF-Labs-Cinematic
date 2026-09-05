# 4N1F Labs Cinematic

Visual-first web development studio with a Figma-style editing workflow, real website source as the canvas, Visual → Code output, sandboxed Preview IDs, patches, responsive transforms, layers, smart guides, and versioned packages.

## Core principle

**Visual-first · code-behind · full ownership**

4N1F Labs lets the user think visually — move, resize, align, group, recolor, edit text, and tune responsive layouts — while the engine preserves source code, generated patches, assets, and revision history behind the scenes.

## Revival baseline

This repository revives the standalone 4N1F Labs editor from the historical checkpoint in `danikrakatau1/buatundangan`:

- Stable baseline: V1.2.4
- Experimental addon retained: V1.2.5 Multi Select + Group
- Historical checkpoint commit: `37a89d585477c5002c81116ab8a5f0ab97a3db25`

## Architecture

`HTML/CSS/JS → immutable package KEY → Preview ID → sandboxed live renderer → visual editor → patches/code → save/publish`

The editor and this repository are intentionally standalone. They must not depend on production application code from the historical host repository.

## Planned cinematic direction

The next generation will keep the existing source-editing engine while evolving the workspace into a premium cinematic visual IDE: Layers on the left, live website canvas in the center, Inspector on the right, direct manipulation handles, smart guides, responsive scopes, animation/effects controls, history/rollback, and cloud/local project modes.

> “Figma-style” describes the interaction model only. 4N1F Labs is an independent product and is not affiliated with Figma.
