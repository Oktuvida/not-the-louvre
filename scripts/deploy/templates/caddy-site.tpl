{
	email {{EMAIL}}
}

{{DOMAIN}} {
	encode zstd gzip
	reverse_proxy {{HOST}}:{{PORT}}
}