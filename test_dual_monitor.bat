@echo off
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

echo Starting Framebound in Dual-Monitor Spanning Mode...
echo Left Monitor: 2560x1600
echo Right Monitor: 2560x1440
echo Total Span: 5120x1600

REM Using a temp profile to avoid interfering with your main browser session
start "" "%CHROME_EXE%" --app="http://localhost:5173" --window-position=0,0 --window-size=5120,1440 --user-data-dir="%TEMP%\FrameboundCoopTest"

echo Done! The window should now span both screens.
echo If it's not perfect, you might need to adjust the position manually or check display alignment in Windows Settings.
pause
