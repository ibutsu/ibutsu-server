export const projectToOption = (project) => {
  if (!project) {
    return '';
  }
  return {
    project: project,
    toString: function () {
      return this.project.title;
    },
    compareTo: function (value) {
      if (value.project) {
        return this.project.id === value.project.id;
      } else {
        return (
          this.project.name.toLowerCase().includes(value.toLowerCase()) ||
          this.project.title.toLowerCase().includes(value.toLowerCase())
        );
      }
    },
  };
};

export const dashboardToOption = (dashboard) => {
  if (!dashboard) {
    return '';
  }
  return {
    dashboard: dashboard,
    toString: function () {
      return this.dashboard.title;
    },
    compareTo: function (value) {
      if (value.dashboard) {
        return this.dashboard.id === value.dashboard.id;
      } else {
        return this.dashboard.title.toLowerCase().includes(value.toLowerCase());
      }
    },
  };
};
