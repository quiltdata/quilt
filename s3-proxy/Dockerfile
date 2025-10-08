FROM amazonlinux:2023.9.20250929.0
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

# Based on:
# - https://hub.docker.com/r/irasnyd/nginx_s3_streaming_zip/dockerfile
# - https://github.com/nginxinc/docker-nginx/blob/5488180ebdd45b12b45107694dfa92dc878a2795/stable/buster/Dockerfile
# - `nginx -V` inside the nginx:1.18.0 container

EXPOSE 80

ENV NGINX_VERSION=1.24.0

# Download and compile Nginx.
# Dependencies:
# - pcre: runtime dependency for nginx
# - gettext: envsubst used by run-nginx.sh
# - shadow-utils: useradd
# - tar, gzip: download the source
# - gcc, make, *-devel: compile nginx
RUN set -x \
    && dnf -y upgrade \
    && dnf -y install --setopt=install_weak_deps=False pcre gettext shadow-utils tar gzip gcc make openssl-devel pcre-devel zlib-devel \
    && cd /root \
    && curl -L http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz | tar zx \
    && cd nginx-${NGINX_VERSION} \
    && mkdir mod_zip \
    && curl -L https://api.github.com/repos/quiltdata/mod_zip/tarball/979314cca0507a59071310f09401861cced73ccb | tar zx --strip-components 1 --directory mod_zip \
    && ./configure \
        --prefix=/etc/nginx \
        --sbin-path=/usr/sbin/nginx \
        --modules-path=/usr/lib/nginx/modules \
        --conf-path=/etc/nginx/nginx.conf \
        --http-log-path=/dev/stdout \
        --error-log-path=/dev/stdout \
        --pid-path=/var/run/nginx.pid \
        --lock-path=/var/run/nginx.lock \
        --http-client-body-temp-path=/var/lib/nginx/tmp/client_temp \
        --http-proxy-temp-path=/var/lib/nginx/tmp/proxy_temp \
        --http-fastcgi-temp-path=/var/lib/nginx/tmp/fastcgi_temp \
        --http-uwsgi-temp-path=/var/lib/nginx/tmp/uwsgi_temp \
        --http-scgi-temp-path=/var/lib/nginx/tmp/scgi_temp \
        --user=nginx \
        --group=nginx \
        --with-compat \
        --with-file-aio \
        --with-threads \
        --with-http_addition_module \
        --with-http_auth_request_module \
        --with-http_dav_module \
        --with-http_flv_module \
        --with-http_gunzip_module \
        --with-http_gzip_static_module \
        --with-http_mp4_module \
        --with-http_random_index_module \
        --with-http_realip_module \
        --with-http_secure_link_module \
        --with-http_slice_module \
        --with-http_ssl_module \
        --with-http_stub_status_module \
        --with-http_sub_module \
        --with-http_v2_module \
        --with-mail \
        --with-mail_ssl_module \
        --with-stream \
        --with-stream_realip_module \
        --with-stream_ssl_module \
        --with-stream_ssl_preread_module \
        --with-cc-opt='-O2 -fstack-protector-strong -Wformat -Werror=format-security -Wp,-D_FORTIFY_SOURCE=2 -fPIC' \
        --with-ld-opt='-Wl,-z,relro -Wl,-z,now -Wl,--as-needed -pie' \
        --add-module=mod_zip \
    && make install \
    && cd .. \
    && rm -r nginx-${NGINX_VERSION} \
    && dnf -y remove gcc make openssl-devel pcre-devel zlib-devel \
    && dnf -y clean all

RUN set -x \
    && useradd --system --user-group --no-create-home --home /nonexistent --shell /sbin/nologin nginx

RUN mkdir -p /var/lib/nginx/tmp/
COPY nginx.conf /root/nginx.conf.tmpl
COPY run-nginx.sh /root/run-nginx.sh
RUN ln -sf /tmp/nginx.conf /etc/nginx/nginx.conf

# Use SIGQUIT for a "graceful" shutdown
STOPSIGNAL SIGQUIT

# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD exec /root/run-nginx.sh
