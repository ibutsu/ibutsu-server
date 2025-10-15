from ibutsu_server.db.models import Result
from ibutsu_server.filters import convert_filter


def _get_comparison_data(additional_filters):
    """Count occurrences of distinct fields within results."""
    if not additional_filters:
        return {
            "results": [],
            "pagination": {
                "totalItems": 0,
            },
        }

    queries = []
    for _ in additional_filters:
        queries.append(Result.query)

    # Create DB ready filter strings
    if additional_filters:
        for i, filter in enumerate(additional_filters):
            filters = filter.split(",")
            for filter_string in filters:
                filter_clause = convert_filter(filter_string, Result)
                if filter_clause is not None:
                    queries[i] = queries[i].filter(filter_clause)

    # Find run IDs for each filter
    # Extract the ID value from the result row tuple
    run_id_1 = queries[0].with_entities(Result.run_id).order_by(Result.start_time.desc()).first()[0]
    run_id_2 = queries[1].with_entities(Result.run_id).order_by(Result.start_time.desc()).first()[0]

    # Get list of tests matching our filters and run IDs
    results_1 = []
    results_2 = []
    if run_id_1:
        results_1 = (
            queries[0].filter(Result.run_id == run_id_1).order_by(Result.data["fspath"]).all()
        )
    if run_id_2:
        results_2 = (
            queries[1].filter(Result.run_id == run_id_2).order_by(Result.data["fspath"]).all()
        )

    # Build matrix by matching results
    # Could revisit this if loading is taking too long
    results = []
    for result_1_obj in results_1:
        result_1 = result_1_obj.to_dict()
        for result_2_obj in results_2:
            result_2 = result_2_obj.to_dict()
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


def get_comparison_data(additional_filters=None):
    return _get_comparison_data(additional_filters=additional_filters)
