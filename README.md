# denBot

A queue bot to enable multiple (default 4) Pokémon players to go on an adventure together via Discord.

## Features

Users can join and leave a queue. When the queue is full users are DMed a code to join the in-game lobby.

Commands:

* q   - Join the queue
* lq  - Leave the queue
* sq  - Show the queue
* cq  - Clear the queue (admin-only, not to be shared with normal users)
* ru  - Remove a tagged user from the queue (admin-only, not to be shared with normal users)

## Dockerize the bot

To build a docker image, open a command window in the project directory and run:

`docker build -t denBot .`

For a sanity check, you can run `docker images` and it should be displayed in that list.

## Running the Docker container

Running the bot with -d runs the container in detatched mode (as in it runs in the background). If you want to see what is happening, remove that option.

`docker run -d denBot`

### More information

If you want more of a sanity check here are some following commands you can run the following commands:

* To view details of running containers: `docker ps`
* To view the container's logs (with a number instead of the <> section): `docker logs <our container's ID>`

To access the command line inside the docker container you can run:

`docker exec -it <container id> /bin/bash`

## Version 2 features list

* Add all queued users to a private temporary text channel in the Discord server. This will probably require:
  * Make a role, give it to all of the users, create a text channel with only that role able to see and join it
  * Then handle deleting that channel and role at the appropriate time, either through a timeout or a command
