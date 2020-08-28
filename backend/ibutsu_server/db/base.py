from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
Model = db.Model
Column = db.Column
Float = db.Float
Integer = db.Integer
LargeBinary = db.LargeBinary
Text = db.Text
session = db.session
