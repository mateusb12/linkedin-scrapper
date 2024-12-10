@echo off

REM Create the .diff file with your prompt content
(
  echo Can you please summarize the diff below into the following snippet format?
  echo ```
  echo Commit title
  echo - Commit key point 1
  echo - Commit key point 2
  echo - Commit key point 3
  echo ```
  echo Please avoid using generic words like 'Enhance' or 'Refactor'. Focus on verbs/actions with concrete meaning.
  echo.
) > commit_changes.diff

REM Append the git diff output to the file
git diff >> commit_changes.diff

echo Diff file created and customized in the current directory.