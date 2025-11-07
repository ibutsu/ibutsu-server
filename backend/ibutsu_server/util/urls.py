def build_url(*url_paths):
    new_url = ""
    for url in url_paths:
        if not url:
            continue
        # If the URL contains a protocol or new_url is empty, use it directly
        # Otherwise, join with the existing path
        new_url = (
            url.strip("/") if "://" in url or not new_url else "/".join([new_url, url.strip("/")])
        )
    return new_url
