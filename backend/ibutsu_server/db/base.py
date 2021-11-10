from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
Model = db.Model
Boolean = db.Boolean
Column = db.Column
DateTime = db.DateTime
Float = db.Float
ForeignKey = db.ForeignKey
Integer = db.Integer
LargeBinary = db.LargeBinary
String = db.String
Table = db.Table
Text = db.Text
relationship = db.relationship
inspect = db.inspect
session = db.session
