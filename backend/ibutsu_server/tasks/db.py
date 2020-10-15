""" Tasks for DB related things"""
# TODO: rewrite for PSQL
# @task
# def _delete_old_files(filename, max_date):
#     """ Delete all files uploaded before the max_date """
#     try:
#         if not isinstance(max_date, datetime):
#             max_date = datetime.fromisoformat(max_date)
#         with lock(f"delete-file-lock-{filename}"):
#             for file in mongo.fs.find({"filename": filename, "uploadDate": {"$lt": max_date}}):
#                 mongo.fs.delete(file._id)
#     except Exception:
#         # we don't want to continually retry this task
#         return
#
#
# @task
# def prune_old_files(months=5):
#     """ Delete artifact files older than specified months (here defined as 4 weeks). """
#     try:
#         if isinstance(months, str):
#             months = int(months)
#
#         if months < 2:
#             # we don't want to remove files more recent than 3 months
#             return
#         files_to_delete = ["traceback.log", "screenshot.png", "iqe.log"]
#         delta = timedelta(weeks=months * 4).total_seconds()
#         current_time = time.time()
#         timestamp_in_sec = current_time - delta
#         # get datetime obj
#         max_date = datetime.fromtimestamp(timestamp_in_sec)
#         # send out the tasks
#         for filename in files_to_delete:
#             try:
#                 _delete_old_files.apply_async((filename, max_date), countdown=5)
#             except OperationalError:
#                 pass
#     except Exception:
#         # we don't want to continually retry this task
#         return
#
#
# @task
# def delete_large_files(limit=256 * 1024):
#     """ Delete 'iqe.log' files larger than the limit, defaults to 256 KiB"""
#     try:
#         if isinstance(limit, str):
#             limit = int(limit)
#
#         if limit < (256 * 1024):
#             # we don't want to remove files smaller than 256 KiB
#             return
#
#         with lock(f"delete-file-lock-{limit}"):
#             for file in mongo.fs.find({"length": {"$gt": limit}, "filename": "iqe.log"}):
#                 mongo.fs.delete(file._id)
#     except Exception:
#         # we don't want to continually retry this task
#         return
