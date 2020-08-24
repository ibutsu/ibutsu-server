from dynaconf import Dynaconf


settings = Dynaconf(settings_files=["settings.yaml"], environments=True)
__all__ = ["settings"]
