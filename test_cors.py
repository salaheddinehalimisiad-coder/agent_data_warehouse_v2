import urllib.request
from urllib.error import HTTPError

req = urllib.request.Request(
    'http://localhost:8000/api/upload-csv',
    headers={'Origin': 'http://localhost:5173'},
    method='POST'
)

try:
    urllib.request.urlopen(req)
except HTTPError as e:
    print("STATUS:", e.code)
    print("HEADERS:")
    for header, value in e.headers.items():
        print(f"{header}: {value}")
