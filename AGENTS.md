## backend
- Use `pre-commit run` to include all lint checks and auto fixes
- Automatically work to resolve failures in the pre-commit output
- Do not include excessive emoji in readme, contributing, and other documentation files
- Use pytest parametrization over subtests
- Suggest updates to pytest-ibutsu or the ibutsu-client-python when there are changes to the openAPI specification
- validate any changes to the openapi specification
- Suggest updates to backend controllers that align with modern implementation patterns

# frontend
- use yarn and yarn lint from the frontend directory as the working directory
- prefer the use of patternfly components
- use functional components and prefer patterns that leverage all available react hook patterns
- use strict react-hooks rules for exhaustive deps
- React imports are necessary for JSX


# general
- Do not create summary documents unless instructed to do so

## Testing instructions
- Find the CI plan in the .github/workflows folder.
- Use a virtual environment and install the test extras to run tests.
- From the package root you can just call `hatch test` or `pytest -x`. The commit should pass all tests before proceeding
- Add or update tests for the code you change, even if nobody asked.
