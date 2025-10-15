"""Test utilities and base classes for ibutsu_server tests."""

from ibutsu_server.db.models import (
    Artifact,
    Dashboard,
    Group,
    Import,
    ImportFile,
    Project,
    Result,
    Run,
    Token,
    User,
    WidgetConfig,
)

# Export the DB models as Mock* classes for backwards compatibility
MockUser = User
MockProject = Project
MockDashboard = Dashboard
MockGroup = Group
MockToken = Token
MockImport = Import
MockImportFile = ImportFile
MockResult = Result
MockRun = Run
MockArtifact = Artifact
MockWidgetConfig = WidgetConfig


def mock_task(*args, **kwargs):
    """Mock task for testing"""
    pass


__all__ = [
    "MockArtifact",
    "MockDashboard",
    "MockGroup",
    "MockImport",
    "MockImportFile",
    "MockProject",
    "MockResult",
    "MockRun",
    "MockToken",
    "MockUser",
    "MockWidgetConfig",
    "mock_task",
]
