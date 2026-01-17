
### How it works?

A standard browser usually opens a single HTTP connection to the server. However, servers typically limit the bandwidth allocated to a single connection to ensure fairness for all users.

Download managers (like Surge) open multiple requests simultaneously (e.g., 32 in Surge). They use this method to split the file into many small parts and download those parts individually.

Not all connections are created equal; there are fast connections and slow connections due to factors like load balancers and CDNs. Download managers employ various methods to optimize these connections.

The top 3 optimizations we did in Surge are:

1. **Split the Largest Chunk:** Split the largest chunk whenever possible so that workers do not remain idle.
   
2. **Work Stealing:** Near the end, when fast workers are finished and slow workers are still processing, make the fast, idle workers "steal work" from the slow workers.
   
3. **Restart Slow Workers:** Calculate the mean speed of all workers. If a worker is performing at less than **0.3x** of the mean, restart it in the hopes that it will secure a better pathway to the server, which will be faster.
