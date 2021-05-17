def build_url(*url_paths):
    new_url = ""
    for url in url_paths:
        if not url:
            continue
        if "://" in url:
            new_url = url.strip("/")
        else:
            new_url = "/".join([new_url, url.strip("/")])
    return new_url
