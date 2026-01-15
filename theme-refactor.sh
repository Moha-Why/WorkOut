#!/bin/bash

# Theme refactoring script - replaces old colors with new theme colors
# This script applies the dark theme across all dashboard pages

# Text colors
find src/app -name "*.tsx" -type f -exec sed -i 's/text-gray-900/text-text-primary/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/text-gray-600\([^-]\)/text-gray-400\1/g' {} +

# Background colors
find src/app -name "*.tsx" -type f -exec sed -i 's/bg-gray-50/bg-bg-secondary/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/bg-gray-100/bg-bg-hover/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/bg-white/bg-bg-secondary/g' {} +

# Border colors
find src/app -name "*.tsx" -type f -exec sed -i 's/border-gray-300/border-border/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/border-gray-200/border-border/g' {} +

# Loading spinners
find src/app -name "*.tsx" -type f -exec sed -i 's/border-gray-300 border-t-black/border-border border-t-accent/g' {} +

# Hover states
find src/app -name "*.tsx" -type f -exec sed -i 's/hover:text-gray-900/hover:text-accent/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/hover:bg-gray-100/hover:bg-bg-hover/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/hover:text-black/hover:text-accent/g' {} +

# Icon colors
find src/app -name "*.tsx" -type f -exec sed -i 's/text-gray-400/text-gray-500/g' {} +

# Specific component backgrounds
find src/app -name "*.tsx" -type f -exec sed -i 's/bg-blue-100/bg-info\/20/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/text-blue-600/text-info/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/bg-green-100/bg-success\/20/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/text-green-600/text-success/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/bg-orange-100/bg-accent\/20/g' {} +
find src/app -name "*.tsx" -type f -exec sed-i 's/text-orange-600/text-accent/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/bg-red-100/bg-error\/20/g' {} +
find src/app -name "*.tsx" -type f -exec sed -i 's/text-red-600/text-error/g' {} +

# Text links
find src/app -name "*.tsx" -type f -exec sed -i 's/text-black/text-accent/g' {} +

echo "Theme refactoring complete!"
