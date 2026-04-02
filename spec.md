# Catch My Heart

## Current State
A multi-scene romantic web app with:
- Level 1: Heart-catching game with pastel gradient background
- Level 2 reveal: Dark scene with glitch transition, slow text reveal, embedded video player
- Final letter scene: exists but needs full content and refined design

## Requested Changes (Diff)

### Add
- Full letter text content with line-by-line animated reveal (typewriter/fade-in style)
- "Play again?" button at the end of the letter scene
- "I'd still choose you." message that appears on button click
- Romantic serif/handwritten font for the letter scene

### Modify
- Final letter scene: redesign as a minimal, elegant letter-style page
- Background: soft cream/white with gentle ambient glow effect
- Text animation: each line appears sequentially, one at a time, with a soft fade or gentle typing feel
- Typography: use Parisienne (handwritten) or PlayfairDisplay/InstrumentSerif (serif romantic) font
- End line slightly larger: "5 months down… and this is just the beginning."

### Remove
- Nothing removed

## Implementation Plan
1. Update the LetterScene component in App.tsx
2. Set background to soft cream (#fef9f2 or similar) with radial glow
3. Import and use Parisienne or PlayfairDisplay font for letter text
4. Implement sequential line-by-line reveal with staggered delays (each line fades in after the previous)
5. Add all specified letter lines with proper paragraph spacing
6. Make final line slightly larger
7. Add "Play again?" button that, on click, shows "I'd still choose you." message
8. Ensure smooth scrolling as lines appear
