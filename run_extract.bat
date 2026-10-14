@echo off
title SPL 2026 - PPTX Player Photo Extractor
echo ========================================================
echo   SMVITM SPL Season 2 - Player List & Photo Extractor
echo ========================================================
echo.
echo Checking for SPL_2026_final-player-list.pptx...
if not exist "SPL_2026_final-player-list.pptx" (
    echo [ERROR] SPL_2026_final-player-list.pptx was not found in this folder!
    echo Please make sure the PPTX is in this folder: %CD%
    echo.
    pause
    exit /b
)

echo Running extract_pptx.py...
python extract_pptx.py

if errorlevel 1 (
    echo.
    echo [NOTE] If python is not recognized, please make sure Python is installed and added to PATH.
) else (
    echo.
    echo ========================================================
    echo   Extraction complete!
    echo   1. Photos saved to: public\players\
    echo   2. Upload list created: spl_players.csv
    echo ========================================================
)

echo.
pause
