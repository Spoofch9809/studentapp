# Frontend (Nginx serving static files and proxying /api)
FROM nginx:alpine
# Copy our Nginx config to replace default
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy static site content
COPY . /usr/share/nginx/html
