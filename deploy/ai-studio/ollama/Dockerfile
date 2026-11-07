FROM ollama/ollama:latest AS upstream

RUN rm -rf \
    /usr/lib/ollama/cuda_v12 \
    /usr/lib/ollama/cuda_v13 \
    /usr/lib/ollama/mlx_cuda_v13 \
    /usr/lib/ollama/vulkan

FROM ubuntu:24.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=upstream /bin/ollama /bin/ollama
COPY --from=upstream /usr/lib/ollama /usr/lib/ollama

EXPOSE 11434
ENTRYPOINT ["/bin/ollama"]
CMD ["serve"]
