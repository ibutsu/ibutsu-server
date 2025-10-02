def build_url(*url_paths):
    new_url = ""
    for url in url_paths:
        if not url:
            continue
        new_url = url.strip("/") if "://" in url else "/".join([new_url, url.strip("/")])
    return new_url
