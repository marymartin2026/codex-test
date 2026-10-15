"""使用 Python 标准库启动本地海报方案助手。"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="启动海报方案助手")
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).parent / 'web'))
    try:
        server = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as error:
        parser.exit(1, f'启动失败：{error}\n可使用 --port 8001 更换端口。\n')
    print(f'海报方案助手已启动，监听 {args.host}:{args.port}；按 Ctrl+C 停止。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
