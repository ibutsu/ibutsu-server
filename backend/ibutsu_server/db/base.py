from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
Model = db.Model
Column = db.Column
LargeBinary = db.LargeBinary
Text = db.Text
Float = db.Float
session = db.session
