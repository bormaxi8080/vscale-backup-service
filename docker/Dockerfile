FROM node:12-buster-slim

RUN mkdir /data
WORKDIR /data
ENV RUN_INTERVAL 1d

COPY run.sh /
RUN chmod +x /run.sh
CMD /run.sh
