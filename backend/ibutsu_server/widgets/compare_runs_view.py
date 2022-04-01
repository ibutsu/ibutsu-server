from ibutsu_server.db.models import Result
from ibutsu_server.filters import convert_filter


def _get_comparison_data(filters):
    """Count occurrences of distinct fields within results."""
    queries = []
    for _ in filters:
        queries.append(Result.query)

    # Create DB ready filter strings
    if filters:
        for i, filter in enumerate(filters):
            filters = filter.split(",")
            for filter_string in filters:
                filter_clause = convert_filter(filter_string, Result)
                if filter_clause is not None:
                    queries[i] = queries[i].filter(filter_clause)

    # Find run IDs for each filter
    run_id_1 = queries[0].with_entities(Result.run_id).order_by(Result.start_time.desc()).first()
    run_id_2 = queries[1].with_entities(Result.run_id).order_by(Result.start_time.desc()).first()

    # Get list of tests matching our filters and run IDs
    results_1 = queries[0].filter(Result.run_id.in_(run_id_1)).order_by(Result.data["fspath"]).all()
    results_2 = queries[1].filter(Result.run_id.in_(run_id_2)).order_by(Result.data["fspath"]).all()

    # Build matrix by matching results
    # Could revisit this if loading is taking too long
    results = []
    for result_1 in results_1:
        result_1 = result_1.to_dict()
        for result_2 in results_2:
            result_2 = result_2.to_dict()
            if (
                result_1["metadata"]["fspath"] == result_2["metadata"]["fspath"]
                and result_1["test_id"] == result_2["test_id"]
                and result_1["result"] != result_2["result"]
            ):
                results.append((result_1, result_2))
                break

    total_items = len(results)

    return {
        "results": [(result_1, result_2) for result_1, result_2 in results],
        "pagination": {
            "totalItems": total_items,
        },
    }


def get_comparison_data(filters=None):
    data = _get_comparison_data(filters=filters)
    return data
