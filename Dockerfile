FROM node:6.9.2
ENV PORT 8080
EXPOSE 8080
COPY . /
CMD npm install
CMD npm start

