# nsfw-reusable-component Specification

## Purpose
Shared NSFW image behavior: blur, reveal, author exemption, and accessibility.

## Requirements

### Requirement: Consistent NSFW blur and reveal
The `NsfwImage.svelte` component SHALL render images with a CSS blur when the artwork is flagged NSFW and the viewer is not the author. The user MAY click the image to reveal it.

#### Scenario: Non-author sees blur
- GIVEN an artwork flagged NSFW
- WHEN the viewer is not the author
- THEN the image renders blurred
- AND clicking the image removes the blur

#### Scenario: Author bypasses blur
- GIVEN an artwork flagged NSFW
- WHEN the viewer is the author
- THEN the image renders without blur

#### Scenario: Non-NSFW image renders normally
- GIVEN an artwork not flagged NSFW
- WHEN any viewer sees it
- THEN the image renders without blur

### Requirement: Accessible blurred images
Blurred NSFW images MUST carry an `aria-label` describing the protected content state.

#### Scenario: Blurred image accessibility
- GIVEN an image is blurred due to NSFW flag
- WHEN the image is in the DOM
- THEN it exposes a descriptive `aria-label`
